import { z } from "zod";

export const createTransactionsSchema = z.object({
  ruleId: z.string().max(16).optional(),
  customTitle: z.string().trim().max(255).optional(),
  customPoints: z.number().optional(),
  studentIds: z.array(z.string().uuid()).min(1).max(500),
  activityDate: z.iso.date(),
  note: z.string().trim().max(1000).optional().default(""),
});

export const importStudentsSchema = z.object({
  fileName: z.string().min(1).max(255),
  mode: z.enum(["replace", "append"]),
  mapping: z.record(z.string(), z.number().int().min(-1)),
  students: z.array(z.object({
    ordinal: z.string().max(50).optional().default(""),
    fullName: z.string().trim().min(1).max(255),
    dateOfBirth: z.string().max(50).optional().default(""),
    gender: z.string().max(50).optional().default(""),
    className: z.string().trim().max(100).optional().default("Chưa phân lớp"),
    phone: z.string().max(50).optional().default(""),
    note: z.string().max(1000).optional().default(""),
  })).min(1).max(5000),
});
