/** Zod schemas for the template-driven interpretation flow. */

import { z } from "zod";

export const StatementSchema = z
  .object({
    id: z.string(),
    template_id: z.string(),
    skill_id: z.string(),
    kind: z.string(),
    locale: z.string(),
    body: z.string(),
    score: z.number(),
    rule_path: z.array(z.string()),
    created_at: z.coerce.date(),
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
  })
  .loose();
export type TemplateInterpretation = z.infer<typeof TemplateInterpretationSchema>;
