import { z } from "zod";

export const healthReportSchema = z.object({
  detail: z.string().trim().max(255).optional().nullable(),
  source: z.string().trim().min(1).max(64),
});

export const healthHistorySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

export type HealthReportInput = z.infer<typeof healthReportSchema>;
export type HealthHistoryInput = z.infer<typeof healthHistorySchema>;
