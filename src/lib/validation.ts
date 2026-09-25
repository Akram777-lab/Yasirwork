import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  jobTitle: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
});

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  title: z.string().min(2, "Title is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  txnDate: z.string().min(8, "Date is required"),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_wallet", "cheque", "other"]),
  vendor: z.string().optional().or(z.literal("")),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  userId: z.coerce.number().int().positive().optional(),
});

export const workLogSchema = z.object({
  logDate: z.string().min(8, "Date is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  project: z.string().optional().or(z.literal("")),
  hours: z.coerce.number().min(0).max(24),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["planned", "in_progress", "completed"]),
  userId: z.coerce.number().int().positive().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["expense", "income", "work"]),
  color: z.string().min(4),
  description: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "employee"]),
  jobTitle: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type WorkLogInput = z.infer<typeof workLogSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UserInput = z.infer<typeof userSchema>;
