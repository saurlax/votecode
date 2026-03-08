import { isNull, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  avatar_url: text().notNull(),
  html_url: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
  offset: integer().notNull(),
  html: text()
    .notNull()
    .default(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>Hello World!</body></html>',
    ),
});

export const prompts = pgTable(
  "prompts",
  {
    id: serial().primaryKey(),
    pageId: text("page_id")
      .references(() => pages.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    pending: boolean().notNull().default(true),
    content: text().notNull(),
    response: text(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("page_id_idx").on(table.pageId),
    uniqueIndex("pending_unique_idx")
      .on(table.pageId, table.userId)
      .where(sql`${table.pending} = true`),
  ],
);

export const votes = pgTable(
  "votes",
  {
    promptId: integer("prompt_id")
      .references(() => prompts.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.promptId, table.userId] })],
);
