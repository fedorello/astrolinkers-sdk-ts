/** LLM resource — non-streaming endpoints + persistence. */

import { beforeEach, describe, expect, it } from "vitest";

import { FakeFetch, newClient, jsonResponse } from "./setup.js";
import { UsageGroupBy } from "../src/index.js";

const INTERP_PAYLOAD = {
  interpretation_type: "theme",
  language: "en",
  tier: "standard",
  content: "Your career theme…",
  engine_context: { theme: "career" },
  input_tokens: 100,
  output_tokens: 250,
  latency_ms: 4200,
  cost_usd: 0.0021,
  interpretation_id: "i-1",
  cached: false,
};

let fake: FakeFetch;

beforeEach(() => {
  fake = new FakeFetch();
});

describe("client.llm.theme", () => {
  it("serialises query params + parses response", async () => {
    fake.on("POST", "/v1/llm/theme/career", () => jsonResponse(INTERP_PAYLOAD));
    const client = newClient(fake);
    const result = await client.llm.theme({
      chartId: "c1",
      theme: "career",
      tier: "standard",
    });
    expect(result.content).toBe("Your career theme…");
    const url = fake.calls.at(-1)!.url;
    expect(url).toContain("chart_id=c1");
    expect(url).toContain("language=en");
    expect(url).toContain("tier=standard");
    expect(url).not.toContain("fresh=");
  });

  it("emits fresh=true when bypass requested", async () => {
    fake.on("POST", "/v1/llm/theme/career", () => jsonResponse(INTERP_PAYLOAD));
    const client = newClient(fake);
    await client.llm.theme({ chartId: "c1", theme: "career", fresh: true });
    expect(fake.calls.at(-1)!.url).toContain("fresh=true");
  });
});

describe("client.llm.dashaForecast", () => {
  it("serialises `at`", async () => {
    fake.on("POST", "/v1/llm/dasha-forecast", () =>
      jsonResponse({ ...INTERP_PAYLOAD, interpretation_type: "dasha_forecast" }),
    );
    const client = newClient(fake);
    await client.llm.dashaForecast({
      chartId: "c1",
      at: new Date("2027-03-01T12:00:00Z"),
    });
    expect(fake.calls.at(-1)!.url).toContain("at=2027-03-01");
  });
});

describe("client.llm persistence", () => {
  it("listStored serialises filters", async () => {
    fake.on("GET", "/v1/llm/interpretations", () =>
      jsonResponse({
        items: [
          {
            id: "i-1",
            chart_id: "c1",
            interpretation_type: "theme",
            theme: "career",
            language: "en",
            tier: "basic",
            content: "x",
            engine_context: {},
            request_params: {},
            input_tokens: 100,
            output_tokens: 250,
            latency_ms: 4200,
            cost_usd: 0.0021,
            created_at: "2026-05-18T22:30:00Z",
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      }),
    );
    const client = newClient(fake);
    const page = await client.llm.listStored({
      chartId: "c1",
      interpretationType: "theme",
      limit: 10,
    });
    expect(page.total).toBe(1);
    const url = fake.calls.at(-1)!.url;
    expect(url).toContain("chart_id=c1");
    expect(url).toContain("interpretation_type=theme");
    expect(url).toContain("limit=10");
  });

  it("usageSummary serialises from + group_by", async () => {
    fake.on("GET", "/v1/llm/usage-summary", () =>
      jsonResponse({
        from_: "2026-05-18T00:00:00Z",
        to: "2026-05-19T00:00:00Z",
        group_by: "tier",
        total: {
          label: null,
          call_count: 3,
          input_tokens: 600,
          output_tokens: 900,
          cost_usd: 0.005,
        },
        breakdown: [
          {
            label: "basic",
            call_count: 2,
            input_tokens: 400,
            output_tokens: 500,
            cost_usd: 0.001,
          },
        ],
      }),
    );
    const client = newClient(fake);
    const summary = await client.llm.usageSummary({
      from: new Date("2026-05-18T00:00:00Z"),
      to: new Date("2026-05-19T00:00:00Z"),
      groupBy: UsageGroupBy.TIER,
    });
    expect(summary.total.call_count).toBe(3);
    const url = fake.calls.at(-1)!.url;
    expect(url).toContain("from=2026-05-18");
    expect(url).toContain("group_by=tier");
  });
});
