/** Zod schema for the talent / hiring profile endpoint. */

import { z } from "zod";

export const SkillScoreSchema = z
  .object({
    skill_id: z.string(),
    value: z.number(),
    level: z.string(),
    contributing_rules: z.array(z.string()),
  })
  .loose();
export type SkillScore = z.infer<typeof SkillScoreSchema>;

export const SkillProfileSchema = z
  .object({
    chart_id: z.string(),
    scores: z.array(SkillScoreSchema),
  })
  .loose();
export type SkillProfile = z.infer<typeof SkillProfileSchema>;
