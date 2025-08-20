import {pgTable,serial,varchar,text,date,timestamp,boolean,index,integer} from "drizzle-orm/pg-core";
import { users } from "./user";
export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey(),
    project_id: integer().notNull(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    sub_tasks: text(),
    start_date: date(),
    due_date: date(),
    status: varchar({ length: 50 }).default("IN_PROGRESS"),
    created_by: integer().references(() => users.id).notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp(),
    deleted_at: timestamp(),
  },
  (t) => [
    index("tasks_id_idx").on(t.id),
    index("project_id_idx").on(t.project_id),
   
  ]
);
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TasksTable = typeof tasks;

