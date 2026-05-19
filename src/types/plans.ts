/** Zod schemas for `/v1/plans` and tenant plan endpoints. */

import { z } from "zod";

export const PlanSchema = z
  .object({
    tier: z.string(),
    display_name: z.string(),
    monthly_price_usd: z.number(),
    rate_limit_capacity: z.number(),
    rate_limit_refill_per_second: z.number(),
    llm_cost_cap_per_hour_usd: z.number().nullable(),
    status: z.string(),
    features: z.array(z.string()),
  })
  .loose();
export type Plan = z.infer<typeof PlanSchema>;

export const TenantPlanSchema = z
  .object({
    tenant_id: z.string(),
    display_name: z.string(),
    plan: PlanSchema,
    plan_updated_at: z.coerce.date(),
    created_at: z.coerce.date(),
  })
  .loose();
export type TenantPlan = z.infer<typeof TenantPlanSchema>;
