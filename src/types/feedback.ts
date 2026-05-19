/** Zod schemas for the feedback + template accuracy loop. */

import { z } from "zod";

export const FeedbackVerdict = {
  CORRECT: "correct",
  DOUBTFUL: "doubtful",
  WRONG: "wrong",
} as const;
export type FeedbackVerdict = (typeof FeedbackVerdict)[keyof typeof FeedbackVerdict];

export const FeedbackRole = {
  SUBJECT: "subject",
  OBSERVER: "observer",
  HR_ADMIN: "hr_admin",
} as const;
export type FeedbackRole = (typeof FeedbackRole)[keyof typeof FeedbackRole];

export const FeedbackEntrySchema = z
  .object({
    id: z.string(),
    statement_id: z.string(),
    chart_id: z.string(),
    template_id: z.string(),
    skill_id: z.string(),
    verdict: z.enum(["correct", "doubtful", "wrong"]),
    role: z.enum(["subject", "observer", "hr_admin"]),
    user_id: z.string().nullable().optional(),
    organization_id: z.string().nullable().optional(),
    comment: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    submitted_at: z.coerce.date(),
  })
  .loose();
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;

export const TemplateAccuracySchema = z
  .object({
    template_id: z.string(),
    sample_size: z.number().int(),
    correct_count: z.number().int(),
    doubtful_count: z.number().int(),
    wrong_count: z.number().int(),
    accuracy: z.number(),
    deprecated: z.boolean(),
    updated_at: z.coerce.date(),
  })
  .loose();
export type TemplateAccuracy = z.infer<typeof TemplateAccuracySchema>;
