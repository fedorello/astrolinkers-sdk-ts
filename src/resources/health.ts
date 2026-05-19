/**
 * Liveness / readiness / version pings.
 *
 * These endpoints sit at the root (not under `/v1`) and require no
 * authentication, but they still flow through the transport so the
 * client's retry / timeout settings apply.
 */

import type { Transport } from "../transport.js";

function ensureDict(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Expected JSON object from ${name} endpoint, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

export class Health {
  constructor(private readonly transport: Transport) {}

  async healthz(): Promise<Record<string, unknown>> {
    const data = await this.transport.request("GET", "/healthz");
    return ensureDict(data, "healthz");
  }

  async readyz(): Promise<Record<string, unknown>> {
    const data = await this.transport.request("GET", "/readyz");
    return ensureDict(data, "readyz");
  }

  async version(): Promise<Record<string, unknown>> {
    const data = await this.transport.request("GET", "/version");
    return ensureDict(data, "version");
  }
}
