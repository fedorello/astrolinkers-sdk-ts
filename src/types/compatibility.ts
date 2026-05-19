/** Zod schemas for compatibility reports. */

import { z } from "zod";

export const CompatibilityAxis = {
  TALENT: "talent",
  ROMANTIC: "romantic",
  TEAM: "team",
} as const;
export type CompatibilityAxis = (typeof CompatibilityAxis)[keyof typeof CompatibilityAxis];

export const CompatibilityReportSchema = z
  .object({
    id: z.string(),
    chart_a_id: z.string(),
    chart_b_id: z.string(),
    axis: z.enum(["talent", "romantic", "team"]),
    verdict: z.string(),
    overall_score_percent: z.number(),
    // Deep structured payloads kept as opaque dicts; consumers index
    // them rather than match against a model.
    ashtakoota: z.record(z.string(), z.unknown()).nullable().optional(),
    synastry: z.record(z.string(), z.unknown()).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    computed_at: z.coerce.date(),
  })
  .loose();
export type CompatibilityReport = z.infer<typeof CompatibilityReportSchema>;
