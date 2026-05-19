/** Zod schemas for `GET /v1/llm/usage-summary`. */

import { z } from "zod";

export const UsageBucketSchema = z.object({
  label: z.string().nullable(),
  call_count: z.number().int(),
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  cost_usd: z.number(),
});
export type UsageBucket = z.infer<typeof UsageBucketSchema>;

export const UsageSummarySchema = z
  .object({
    // The API serialises the lower bound as ``from_``; we keep the
    // alias to avoid colliding with the TS reserved word.
    from_: z.coerce.date(),
    to: z.coerce.date(),
    group_by: z.string(),
    total: UsageBucketSchema,
    breakdown: z.array(UsageBucketSchema).default([]),
  })
  .loose();
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
