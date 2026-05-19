/**
 * Usage resource — hourly API-call buckets per key or per tenant.
 *
 * Distinct from `client.llm.usageSummary` which aggregates LLM spend;
 * this resource counts raw API hits.
 */

import type { QueryValue, Transport } from "../transport.js";
import { type HourlyUsage, HourlyUsageSchema } from "../types/usage-buckets.js";

export interface UsageWindow {
  since?: Date;
  until?: Date;
}

function params(window: UsageWindow): Record<string, QueryValue> {
  return {
    since: window.since ? window.since.toISOString() : undefined,
    until: window.until ? window.until.toISOString() : undefined,
  };
}

export class Usage {
  constructor(private readonly transport: Transport) {}

  async apiKey(keyId: string, window: UsageWindow = {}): Promise<HourlyUsage> {
    const data = await this.transport.request("GET", `/v1/api-keys/${keyId}/usage`, {
      params: params(window),
    });
    return HourlyUsageSchema.parse(data);
  }

  async tenant(window: UsageWindow = {}): Promise<HourlyUsage> {
    const data = await this.transport.request("GET", "/v1/tenant/usage", {
      params: params(window),
    });
    return HourlyUsageSchema.parse(data);
  }
}
