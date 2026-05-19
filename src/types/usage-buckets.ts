/**
 * Zod schemas for the `/usage` family.
 *
 * Separate from `usage.ts` (LLM cost summary). These are raw API-hit
 * buckets per key or per tenant.
 */

import { z } from "zod";

export const HourlyUsageBucketSchema = z
  .object({
    bucket_hour: z.coerce.date(),
    requests: z.number().int(),
    errors_4xx: z.number().int(),
    errors_5xx: z.number().int(),
    latency_p95_ms: z.number().nullable(),
  })
  .loose();
export type HourlyUsageBucket = z.infer<typeof HourlyUsageBucketSchema>;

export const HourlyUsageSchema = z
  .object({
    since: z.coerce.date(),
    until: z.coerce.date(),
    total_requests: z.number().int(),
    total_errors: z.number().int(),
    buckets: z.array(HourlyUsageBucketSchema),
  })
  .loose();
export type HourlyUsage = z.infer<typeof HourlyUsageSchema>;
