/** Zod schema for the talent / hiring profile endpoint. */

import { z } from "zod";

export const SkillProfileSchema = z
  .object({
    chart_id: z.string(),
    locale: z.string().nullable().optional(),
    skills: z.array(z.record(z.string(), z.unknown())).default([]),
    strengths: z.array(z.record(z.string(), z.unknown())).default([]),
    risks: z.array(z.record(z.string(), z.unknown())).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .loose();
export type SkillProfile = z.infer<typeof SkillProfileSchema>;
