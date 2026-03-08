import { db } from "@nuxthub/db";
import { sql } from "drizzle-orm";

export default defineNitroPlugin(async () => {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
});
