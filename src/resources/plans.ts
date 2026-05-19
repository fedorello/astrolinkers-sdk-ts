/** Plans resource — catalogue + tenant plan management. */

import type { Transport } from "../transport.js";
import { type Plan, PlanSchema, type TenantPlan, TenantPlanSchema } from "../types/plans.js";

export class Plans {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Plan[]> {
    const data = await this.transport.request("GET", "/v1/plans");
    const items = data && typeof data === "object" && "items" in data ? data.items : data;
    return PlanSchema.array().parse(items);
  }

  async getTenantPlan(): Promise<TenantPlan> {
    const data = await this.transport.request("GET", "/v1/tenant/plan");
    return TenantPlanSchema.parse(data);
  }

  async setTenantPlan(params: { planTier: string }): Promise<TenantPlan> {
    const data = await this.transport.request("POST", "/v1/tenant/plan", {
      json: { plan_tier: params.planTier },
    });
    return TenantPlanSchema.parse(data);
  }
}
