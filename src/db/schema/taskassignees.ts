import {index,integer,pgTable,serial,timestamp,unique,varchar,} from "drizzle-orm/pg-core";
import { tasks } from "./task";
import { users } from "./user";
import { relations } from "drizzle-orm";

export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: serial("id").primaryKey(),

    // one task → can be assigned to many users
    task_id: integer("task_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),

    // one user → can have many task assignments
    assigned_to: integer("assigned_to")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    status: varchar("status", { length: 50 }).default("PENDING"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
    deleted_at: timestamp("deleted_at"),
  },
  (t) => ({
    taskAssignmentTaskIdx: index("task_assignment_task_idx").on(t.task_id),
    taskAssignmentUserIdx: index("task_assignment_user_idx").on(t.assigned_to),

    // prevent same user from being assigned to same task twice
    taskAssignmentUnqIdx: unique().on(t.task_id, t.assigned_to),
  })
);

export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;
export type TaskAssignmentTable = typeof taskAssignments;

// Relations
export const taskAssignmentsRelations = relations(
  taskAssignments,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAssignments.task_id],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [taskAssignments.assigned_to],
      references: [users.id],
    }),
  })
);
