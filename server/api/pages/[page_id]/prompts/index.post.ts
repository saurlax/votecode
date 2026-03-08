import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }

  const { user } = await requireUserSession(event);
  const storage = useStorage();

  const body = await readBody(event);
  await db
    .insert(schema.prompts)
    .values({
      pageId: page_id,
      userId: user.id,
      content: body.content,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.prompts.pageId, schema.prompts.userId],
      targetWhere: eq(schema.prompts.pending, true),
      set: { content: body.content, createdAt: new Date() },
    })
    .returning();
  storage.setItem(`pages:${page_id}:refresh`, true);
  return [];
});
