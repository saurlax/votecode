import { db, schema } from "@nuxthub/db";
import { count, eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  return db
    .select({
      id: schema.pages.id,
      voteCount: count(schema.votes).as("voteCount"),
    })
    .from(schema.pages)
    .leftJoin(schema.prompts, eq(schema.prompts.pageId, schema.pages.id))
    .leftJoin(schema.votes, eq(schema.votes.promptId, schema.prompts.id))
    .groupBy(schema.pages.id)
    .orderBy(desc(count(schema.votes)))
    .limit(10);
});
