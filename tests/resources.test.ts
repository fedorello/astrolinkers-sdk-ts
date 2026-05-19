/** Happy-path coverage for every non-LLM resource + Vedic samples. */

import { beforeEach, describe, expect, it } from "vitest";

import { FakeFetch, newClient, jsonResponse } from "./setup.js";
import { BhavaStyle, HouseSignificator, TheoArea, Varga, VimshopakaGroup } from "../src/index.js";

let fake: FakeFetch;

beforeEach(() => {
  fake = new FakeFetch();
});

// ── Escape hatch ────────────────────────────────────────────────

describe("client.request", () => {
  it("forwards arbitrary GET", async () => {
    fake.on("GET", "/v1/some-future-endpoint", () => jsonResponse({ ok: true }));
    const client = newClient(fake);
    const body = await client.request("GET", "/v1/some-future-endpoint");
    expect(body).toEqual({ ok: true });
  });

  it("forwards arbitrary POST with JSON body", async () => {
    fake.on("POST", "/v1/some-future-endpoint", () => jsonResponse({ received: true }));
    const client = newClient(fake);
    const body = await client.request("POST", "/v1/some-future-endpoint", {
      json: { hello: "world" },
    });
    expect(body).toEqual({ received: true });
    expect(fake.calls.at(-1)!.body).toBe('{"hello":"world"}');
  });
});

// ── api_keys ────────────────────────────────────────────────────

describe("client.apiKeys", () => {
  it("issue returns plaintext token", async () => {
    fake.on("POST", "/v1/api-keys", () =>
      jsonResponse(
        {
          api_key: {
            id: "k1",
            name: "n",
            scopes: ["charts:read"],
            created_at: "2026-05-18T22:00:00Z",
          },
          token: "alk_secret_…",
        },
        { status: 201 },
      ),
    );
    const client = newClient(fake);
    const issued = await client.apiKeys.issue({ name: "n", scopes: ["charts:read"] });
    expect(issued.token).toBe("alk_secret_…");
    expect(issued.api_key.id).toBe("k1");
  });

  it("list returns parsed items", async () => {
    fake.on("GET", "/v1/api-keys", () =>
      jsonResponse({
        items: [
          {
            id: "k1",
            name: "n",
            scopes: ["charts:read"],
            created_at: "2026-05-18T22:00:00Z",
          },
        ],
      }),
    );
    const client = newClient(fake);
    const keys = await client.apiKeys.list();
    expect(keys).toHaveLength(1);
    expect(keys[0]!.id).toBe("k1");
  });
});

// ── compatibility ───────────────────────────────────────────────

describe("client.compatibility", () => {
  it("create", async () => {
    fake.on("POST", "/v1/compatibility", () =>
      jsonResponse(
        {
          id: "r1",
          chart_a_id: "a",
          chart_b_id: "b",
          axis: "talent",
          verdict: "good",
          overall_score_percent: 78.5,
          computed_at: "2026-05-18T22:00:00Z",
        },
        { status: 201 },
      ),
    );
    const client = newClient(fake);
    const report = await client.compatibility.create({ chartAId: "a", chartBId: "b" });
    expect(report.overall_score_percent).toBe(78.5);
  });
});

// ── feedback ────────────────────────────────────────────────────

describe("client.feedback", () => {
  it("submit returns parsed entry", async () => {
    fake.on("POST", "/v1/feedback", () =>
      jsonResponse(
        {
          id: "f1",
          statement_id: "s1",
          chart_id: "c1",
          template_id: "t1",
          skill_id: "k1",
          verdict: "correct",
          role: "subject",
          submitted_at: "2026-05-18T22:00:00Z",
        },
        { status: 201 },
      ),
    );
    const client = newClient(fake);
    const fb = await client.feedback.submit({ statementId: "s1", verdict: "correct" });
    expect(fb.verdict).toBe("correct");
  });
});

// ── interpretations (template-driven) ──────────────────────────

describe("client.interpretations.create", () => {
  it("creates a template interpretation", async () => {
    fake.on("POST", "/v1/interpretations", () =>
      jsonResponse(
        {
          id: "i1",
          chart_id: "c1",
          locale: "en",
          tone: "corporate",
          statements: [{ id: "s1", template_id: "t1", skill_id: "k1", text: "x" }],
          created_at: "2026-05-18T22:00:00Z",
        },
        { status: 201 },
      ),
    );
    const client = newClient(fake);
    const interp = await client.interpretations.create({ chartId: "c1" });
    expect(interp.statements[0]!.id).toBe("s1");
  });
});

// ── plans ───────────────────────────────────────────────────────

describe("client.plans", () => {
  it("list", async () => {
    fake.on("GET", "/v1/plans", () =>
      jsonResponse({
        items: [
          { tier: "free", name: "Free" },
          { tier: "pro", name: "Pro", monthly_price_usd: 49 },
        ],
      }),
    );
    const client = newClient(fake);
    const plans = await client.plans.list();
    expect(plans.map((p) => p.tier)).toEqual(["free", "pro"]);
  });
});

// ── profiles ────────────────────────────────────────────────────

describe("client.profiles", () => {
  it("talent", async () => {
    fake.on("GET", "/v1/charts/c1/profile/talent", () =>
      jsonResponse({ chart_id: "c1", locale: "en", skills: [{ id: "s1" }] }),
    );
    const client = newClient(fake);
    const prof = await client.profiles.talent("c1");
    expect(prof.chart_id).toBe("c1");
  });
});

// ── reports ─────────────────────────────────────────────────────

describe("client.reports", () => {
  it("create + poll", async () => {
    fake
      .on("POST", "/v1/reports", () =>
        jsonResponse(
          {
            id: "r1",
            chart_id: "c1",
            kind: "talent_lens",
            format: "pdf",
            locale: "en",
            tone: "corporate",
            status: "pending",
            created_at: "2026-05-18T22:00:00Z",
          },
          { status: 202 },
        ),
      )
      .on("GET", "/v1/reports/r1", () =>
        jsonResponse({
          id: "r1",
          chart_id: "c1",
          kind: "talent_lens",
          format: "pdf",
          locale: "en",
          tone: "corporate",
          status: "ready",
          artifact_url: "https://signed.example/r1.pdf",
          created_at: "2026-05-18T22:00:00Z",
        }),
      );
    const client = newClient(fake);
    const job = await client.reports.create({ chartId: "c1", format: "pdf" });
    expect(job.status).toBe("pending");
    const polled = await client.reports.retrieve("r1");
    expect(polled.status).toBe("ready");
  });
});

// ── usage (raw API hits) ───────────────────────────────────────

describe("client.usage", () => {
  it("per-key + per-tenant", async () => {
    const payload = {
      buckets: [{ hour: "2026-05-18T22:00:00Z", request_count: 5 }],
      total_requests: 5,
    };
    fake
      .on("GET", "/v1/api-keys/k1/usage", () => jsonResponse(payload))
      .on("GET", "/v1/tenant/usage", () => jsonResponse(payload));
    const client = newClient(fake);
    expect((await client.usage.apiKey("k1")).total_requests).toBe(5);
    expect((await client.usage.tenant()).total_requests).toBe(5);
  });
});

// ── health ──────────────────────────────────────────────────────

describe("client.health", () => {
  it("healthz / readyz / version", async () => {
    fake
      .on("GET", "/healthz", () => jsonResponse({ status: "ok" }))
      .on("GET", "/readyz", () => jsonResponse({ status: "ready" }))
      .on("GET", "/version", () => jsonResponse({ version: "1.0.0" }));
    const client = newClient(fake);
    expect((await client.health.healthz()).status).toBe("ok");
    expect((await client.health.readyz()).status).toBe("ready");
    expect((await client.health.version()).version).toBe("1.0.0");
  });
});

// ── vedic — representative coverage ────────────────────────────

describe("client.vedic", () => {
  it("divisional uses the enum value in path", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/divisional/D9", () =>
      jsonResponse({ varga: "D9", planets: {} }),
    );
    const client = newClient(fake);
    const data = await client.vedic.divisional("c1", Varga.D9);
    expect(data.varga).toBe("D9");
  });

  it("bhavaChakra serialises style", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/bhava-chakra", () => jsonResponse({ style: "equal" }));
    const client = newClient(fake);
    await client.vedic.bhavaChakra("c1", { style: BhavaStyle.EQUAL });
    expect(fake.calls.at(-1)!.url).toContain("style=equal");
  });

  it("panchanga carries at + lat + lon", async () => {
    fake.on("GET", "/v1/vedic/panchanga", () => jsonResponse({ tithi: "Purnima" }));
    const client = newClient(fake);
    await client.vedic.panchanga({
      at: new Date("2026-05-18T12:00:00Z"),
      lat: 28.6139,
      lon: 77.209,
    });
    const url = fake.calls.at(-1)!.url;
    expect(url).toContain("at=2026-05-18");
    expect(url).toContain("lat=28.6139");
    expect(url).toContain("lon=77.209");
  });

  it("vimshopaka serialises group", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/vimshopaka/jupiter", () => jsonResponse({ bala: 17.3 }));
    const client = newClient(fake);
    await client.vedic.vimshopaka("c1", "jupiter", { group: VimshopakaGroup.SHODASHA_VARGA });
    expect(fake.calls.at(-1)!.url).toContain("group=shodasha_varga");
  });

  it("theoThematic uses enum value in path", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/theo/thematic/career", () =>
      jsonResponse({ area: "career" }),
    );
    const client = newClient(fake);
    const out = await client.vedic.theoThematic("c1", TheoArea.CAREER);
    expect(out.area).toBe("career");
  });

  it("probability with HouseSignificator and at", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/probability/marriage_for_man", () =>
      jsonResponse({ final: 0.42 }),
    );
    const client = newClient(fake);
    const out = await client.vedic.probability("c1", HouseSignificator.MARRIAGE_FOR_MAN, {
      at: new Date("2026-06-01T00:00:00Z"),
    });
    expect(out.final).toBe(0.42);
    expect(fake.calls.at(-1)!.url).toContain("at=2026-06-01");
  });

  it("kpLookup carries longitude_deg", async () => {
    fake.on("GET", "/v1/vedic/kp/lookup", () => jsonResponse({ rashi: "leo" }));
    const client = newClient(fake);
    await client.vedic.kpLookup({ longitudeDeg: 132.5 });
    expect(fake.calls.at(-1)!.url).toContain("longitude_deg=132.5");
  });

  it("muhurta carries window + top_n", async () => {
    fake.on("GET", "/v1/vedic/charts/c1/muhurta", () => jsonResponse({ candidates: [] }));
    const client = newClient(fake);
    await client.vedic.muhurta("c1", {
      windowStart: new Date("2026-12-01T00:00:00Z"),
      windowEnd: new Date("2026-12-03T00:00:00Z"),
      intervalMinutes: 180,
      topN: 5,
    });
    const url = fake.calls.at(-1)!.url;
    expect(url).toContain("interval_minutes=180");
    expect(url).toContain("top_n=5");
  });
});
