import { db, schema } from "@nuxthub/db";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  sql,
} from "drizzle-orm";
import { CronJob } from "cron";
import { Message, streamObject, toAsyncIterator } from "xsai";
import { z } from "zod";

async function generate(pageId: string) {
  const storage = useStorage();

  await db.transaction(async (tx) => {
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${pageId})) as lock`,
    );
    const lock = lockResult[0]?.lock as boolean;

    if (!lock) {
      throw createError({
        statusCode: 409,
        statusMessage: "Another generate is already running for this page",
      });
    }

    const page = await tx.query.pages.findFirst({
      where: eq(schema.pages.id, pageId),
    });

    if (!page) {
      throw createError({
        statusCode: 404,
        statusMessage: "Page not found",
      });
    }

    const pendingPrompts = await tx
      .select({
        ...getTableColumns(schema.prompts),
        voteCount: count(schema.votes),
      })
      .from(schema.prompts)
      .where(
        and(
          eq(schema.prompts.pageId, pageId),
          eq(schema.prompts.pending, true),
        ),
      )
      .leftJoin(schema.votes, eq(schema.prompts.id, schema.votes.promptId))
      .groupBy(schema.prompts.id);

    if (!pendingPrompts[0]) {
      return;
    }

    const bestPrompt = pendingPrompts.reduce((max, prompt) => {
      return prompt.voteCount > max.voteCount ? prompt : max;
    }, pendingPrompts[0]);

    const historyPrompts = await tx
      .select({
        userId: schema.prompts.userId,
        content: schema.prompts.content,
        response: schema.prompts.response,
      })
      .from(schema.prompts)
      .where(
        and(
          eq(schema.prompts.pageId, pageId),
          isNotNull(schema.prompts.response),
        ),
      )
      .orderBy(desc(schema.prompts.createdAt))
      .limit(5);

    const { partialObjectStream } = await streamObject({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL!,
      model: process.env.OPENAI_MODEL!,
      messages: [
        {
          role: "system",
          content: `You are a web programming assistant. Based on the user's requirements, make the necessary modifications, and then output the complete updated HTML content of the page along with your response.`,
        },
        ...(historyPrompts
          .reverse()
          .map((msg) => [
            {
              role: "user",
              content: msg.content,
            },
            {
              role: "assistant",
              content: msg.response,
            },
          ])
          .flat() as Message[]),

        {
          role: "user",
          content: JSON.stringify({
            html: page.html,
            content: bestPrompt.content,
          }),
        },
      ],
      schema: z.object({
        response: z.string().describe("The assistant's reply to the user"),
        html: z
          .string()
          .optional()
          .describe("The complete updated HTML content of the page"),
      }),
    });

    let finalChunk: any;

    for await (const chunk of toAsyncIterator(partialObjectStream)) {
      storage.setItem(`pages:${pageId}:prompts:${bestPrompt.id}`, {
        response: chunk.response,
      });
      if (chunk.html) {
        storage.setItem(`pages:${pageId}:html`, chunk.html);
      }
      finalChunk = chunk;
    }

    await tx
      .update(schema.prompts)
      .set({ pending: false })
      .where(
        and(
          eq(schema.prompts.pageId, pageId),
          eq(schema.prompts.pending, true),
        ),
      );

    await tx
      .update(schema.prompts)
      .set({ response: finalChunk.response })
      .where(eq(schema.prompts.id, bestPrompt.id));

    await tx
      .update(schema.pages)
      .set({ html: finalChunk.html })
      .where(eq(schema.pages.id, pageId));
  });

  await storage.setItem(`pages:${pageId}:refresh`, true);
}

export default defineNitroPlugin(() => {
  const { voteIntervalMinutes } = useAppConfig();
  const job = new CronJob("* * * * *", async () => {
    const offset = Math.floor((Date.now() / 1000 / 60) % voteIntervalMinutes);
    const pages = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.offset, offset));

    await Promise.allSettled(
      pages.map(async (page) => {
        await generate(page.id);
      }),
    );
  });
  job.start();
});
