/** Error-mapping behaviour of the transport. */

import { beforeEach, describe, expect, it } from "vitest";

import { FakeFetch, newClient, jsonResponse } from "./setup.js";
import {
  AuthenticationError,
  BudgetExceededError,
  InvalidRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitedError,
  ServerError,
} from "../src/index.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    message_key: string;
    details?: Record<string, unknown>;
  };
}

function envelope(code: string, details?: Record<string, unknown>): ErrorBody {
  const inner: ErrorBody["error"] = {
    code,
    message: "x",
    message_key: `errors.common.${code}`,
  };
  if (details) inner.details = details;
  return { error: inner };
}

let fake: FakeFetch;

beforeEach(() => {
  fake = new FakeFetch();
});

describe("status → typed exception", () => {
  it.each([
    [401, "unauthorized", AuthenticationError],
    [403, "forbidden", PermissionDeniedError],
    [404, "chart_not_found", NotFoundError],
    [422, "invalid_request", InvalidRequestError],
    [500, "internal_error", ServerError],
    [502, "bad_gateway", ServerError],
  ])("maps %s to the matching error", async (status, code, ErrorClass) => {
    fake.on("GET", "/v1/charts/x", () => jsonResponse(envelope(code), { status }));
    const client = newClient(fake);
    await expect(client.charts.retrieve("x")).rejects.toBeInstanceOf(ErrorClass);
  });
});

describe("rate-limited", () => {
  it("reads Retry-After header", async () => {
    fake.on("GET", "/v1/charts/x", () =>
      jsonResponse(envelope("llm_tier_rate_limited"), {
        status: 429,
        headers: { "Retry-After": "12" },
      }),
    );
    const client = newClient(fake);
    try {
      await client.charts.retrieve("x");
      throw new Error("Expected RateLimitedError");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBe(12);
    }
  });

  it("falls back to body retry_after_seconds when header missing", async () => {
    fake.on("GET", "/v1/charts/x", () =>
      jsonResponse(envelope("llm_tier_rate_limited", { retry_after_seconds: 7 }), { status: 429 }),
    );
    const client = newClient(fake);
    try {
      await client.charts.retrieve("x");
      throw new Error("Expected RateLimitedError");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBe(7);
    }
  });
});

describe("budget exceeded", () => {
  it("exposes capUsd / spentUsd", async () => {
    fake.on("GET", "/v1/charts/x", () =>
      jsonResponse(envelope("llm_budget_exceeded", { cap_usd: 5, spent_usd: 5.43 }), {
        status: 429,
      }),
    );
    const client = newClient(fake);
    try {
      await client.charts.retrieve("x");
      throw new Error("Expected BudgetExceededError");
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      expect((err as BudgetExceededError).capUsd).toBe(5);
      expect((err as BudgetExceededError).spentUsd).toBe(5.43);
    }
  });
});
