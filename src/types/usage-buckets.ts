/**
 * Zod schemas for the `/usage` family.
 *
 * Separate from `usage.ts` (LLM cost summary). These are raw API-hit
 * buckets per key or per tenant.
 */

import { z } from "zod";

export const HourlyUsageBucketSchema = z
  .object({
    hour: z.coerce.date(),
    request_count: z.number().int(),
    success_count: z.number().int().default(0),
    error_count: z.number().int().default(0),
    last_request_at: z.coerce.date().nullable().optional(),
  })
  .loose();
export type HourlyUsageBucket = z.infer<typeof HourlyUsageBucketSchema>;

export const HourlyUsageSchema = z
  .object({
    buckets: z.array(HourlyUsageBucketSchema).default([]),
    total_requests: z.number().int().default(0),
  })
  .loose();
export type HourlyUsage = z.infer<typeof HourlyUsageSchema>;
