/** Zod schemas for the template-driven interpretation flow. */

import { z } from "zod";

export const StatementSchema = z
  .object({
    id: z.string(),
    template_id: z.string(),
    skill_id: z.string(),
    text: z.string(),
    confidence: z.number().nullable().optional(),
  })
  .loose();
export type Statement = z.infer<typeof StatementSchema>;

export const TemplateInterpretationSchema = z
  .object({
    id: z.string(),
    chart_id: z.string(),
    locale: z.string(),
    tone: z.string(),
    statements: z.array(StatementSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    created_at: z.coerce.date(),
  })
  .loose();
export type TemplateInterpretation = z.infer<typeof TemplateInterpretationSchema>;
