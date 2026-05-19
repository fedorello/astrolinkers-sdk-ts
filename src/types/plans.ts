/** Zod schemas for `/v1/plans` and tenant plan endpoints. */

import { z } from "zod";

export const PlanSchema = z
  .object({
    tier: z.string(),
    name: z.string(),
    monthly_price_usd: z.number().nullable().optional(),
    monthly_call_cap: z.number().int().nullable().optional(),
    features: z.array(z.string()).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .loose();
export type Plan = z.infer<typeof PlanSchema>;

export const TenantPlanSchema = z
  .object({
    tier: z.string(),
    activated_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .loose();
export type TenantPlan = z.infer<typeof TenantPlanSchema>;
