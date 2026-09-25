import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  numeric,
  integer,
  boolean,
  date,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    // admin | manager | employee
    role: varchar("role", { length: 20 }).notNull().default("employee"),
    jobTitle: varchar("job_title", { length: 120 }),
    department: varchar("department", { length: 120 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_token_idx").on(t.token)],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  // expense | income | work
  type: varchar("type", { length: 20 }).notNull().default("expense"),
  color: varchar("color", { length: 20 }).notNull().default("#4f46e5"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    // income | expense
    type: varchar("type", { length: 20 }).notNull().default("expense"),
    title: varchar("title", { length: 200 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    txnDate: date("txn_date").notNull(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("cash"),
    vendor: varchar("vendor", { length: 160 }),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    // pending | approved | rejected
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("txn_date_idx").on(t.txnDate), index("txn_user_idx").on(t.userId)],
);

export const workLogs = pgTable(
  "work_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    project: varchar("project", { length: 160 }),
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull().default("0"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    // planned | in_progress | completed
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("worklog_date_idx").on(t.logDate), index("worklog_user_idx").on(t.userId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    followUpDate: date("follow_up_date"),
    // low | medium | high | urgent
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    // todo | in_progress | blocked | done
    status: varchar("status", { length: 20 }).notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_status_idx").on(t.status)],
);

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 40 }).notNull(),
  entity: varchar("entity", { length: 40 }).notNull(),
  entityId: integer("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type WorkLog = typeof workLogs.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
