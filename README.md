# Astrolinkers TypeScript SDK

Official TypeScript / JavaScript client for the
[Astrolinkers API](https://astrolinkers.com) — natal charts, talent
profiles, Vedic calculations, and engine-grounded LLM interpretations.

- **Async-first** single client (`Astrolinkers`) — Node 18+, Bun,
  Cloudflare Workers, modern browsers.
- **Fully typed** — Pydantic-equivalent Zod schemas, ESM + CJS
  output with `.d.mts` / `.d.cts` declarations.
- **Streaming** of LLM interpretations as a typed async iterator.
- **Retry-aware** — honours `Retry-After`, jittered exponential
  backoff on transient failures.
- **Multilingual** — English plus 8 Indian languages + Spanish.

> Status: alpha (`0.1.2`). Public API may shift between minor
> releases until `1.0`. Pin the minor version.

---

## Install

```bash
npm  install @astrolinkers/sdk-ts
pnpm add     @astrolinkers/sdk-ts
yarn add     @astrolinkers/sdk-ts
```

Requires Node 18+ (uses global `fetch`).

## Resource map

| Resource                 | Wraps                                         | Notes                                                                                |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `client.charts`          | `/v1/charts`                                  | Compute / fetch natal charts.                                                        |
| `client.llm`             | `/v1/llm/...` (sync + stream)                 | LLM interpretations + persistence + usage summary.                                   |
| `client.interpretations` | `/v1/interpretations`                         | Template-driven flow + statements.                                                   |
| `client.compatibility`   | `/v1/compatibility`                           | Synastry + ashtakoota between two charts.                                            |
| `client.feedback`        | `/v1/feedback`                                | Statement verdicts + template accuracy.                                              |
| `client.profiles`        | `/v1/charts/{id}/profile/talent`              | Talent / hiring skill profile.                                                       |
| `client.reports`         | `/v1/reports`                                 | Async PDF / HTML report generation.                                                  |
| `client.vedic`           | 58 × `/v1/vedic/...`                          | Full Vedic engine — divisional, dasha, shadbala, panchanga, predictive, KP, muhurta. |
| `client.apiKeys`         | `/v1/api-keys`                                | Issue / list / revoke your own tokens.                                               |
| `client.plans`           | `/v1/plans`, `/v1/tenant/plan`                | Catalogue + tenant plan.                                                             |
| `client.usage`           | `/v1/api-keys/{id}/usage`, `/v1/tenant/usage` | Hourly API-call buckets.                                                             |
| `client.health`          | `/healthz`, `/readyz`, `/version`             | Liveness / readiness / build info.                                                   |
| `client.request(...)`    | any                                           | Escape hatch for endpoints not yet wrapped.                                          |

## Quickstart

```ts
import { Astrolinkers, InterpretationTier, Language } from "@astrolinkers/sdk-ts";

const client = new Astrolinkers({ apiKey: process.env.ASTROLINKERS_API_KEY! });

// 1. Compute a natal chart.
const chart = await client.charts.create({
  moment: new Date("1990-04-15T02:00:00Z"),
  latitude: 28.6139,
  longitude: 77.209,
  timezone: "Asia/Kolkata",
  locationName: "New Delhi, India",
});

// 2. Per-life-area interpretation.
const career = await client.llm.theme({
  chartId: chart.id,
  theme: "career",
  language: Language.EN,
  tier: InterpretationTier.STANDARD,
});
console.log(career.content);

// 3. Full-chart reading at premium depth, in Hindi.
const reading = await client.llm.chartReading({
  chartId: chart.id,
  language: Language.HI,
  tier: InterpretationTier.PREMIUM,
});
console.log(reading.costUsd, reading.cached);
```

## Streaming

```ts
import { Astrolinkers } from "@astrolinkers/sdk-ts";

const client = new Astrolinkers({ apiKey: "alk_live_…" });

for await (const event of client.llm.chartReadingStream({
  chartId: chart.id,
  tier: "standard",
})) {
  switch (event.kind) {
    case "meta":
      renderEngineBlocks(event.engine_context);
      break;
    case "delta":
      appendText(event.content);
      break;
    case "done":
      showCost(event.cost_usd, event.cached);
      break;
    case "error":
      showError(event.error ?? "stream failed");
      break;
  }
}
```

## Re-reading past LLM interpretations

Every successful LLM call is persisted server-side; the SDK exposes
`listStored` / `retrieveStored` on `client.llm`:

```ts
const page = await client.llm.listStored({ chartId: chart.id, limit: 20 });
for (const row of page.items) {
  console.log(row.id, row.interpretation_type, row.cost_usd, row.created_at);
}

const row = await client.llm.retrieveStored(page.items[0]!.id);
console.log(row.content);
```

## Usage analytics

```ts
import { UsageGroupBy } from "@astrolinkers/sdk-ts";

const today = new Date();
const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

const summary = await client.llm.usageSummary({
  from: monthAgo,
  to: today,
  groupBy: UsageGroupBy.TIER,
});
console.log(`30-day LLM spend: $${summary.total.cost_usd.toFixed(4)}`);
for (const bucket of summary.breakdown) {
  console.log(`  ${bucket.label}: ${bucket.call_count} calls, $${bucket.cost_usd.toFixed(4)}`);
}
```

## Vedic engine

```ts
import { Varga, TheoArea, HouseSignificator } from "@astrolinkers/sdk-ts";

// Divisional chart D9 (navamsa).
const d9 = await client.vedic.divisional(chart.id, Varga.D9);

// Composite per-planet strength.
const strengths = await client.vedic.compositeStrength(chart.id);

// Date-bound career probability folding in current transit modifier.
const prob = await client.vedic.materializationAt(chart.id, TheoArea.CAREER, {
  at: new Date(),
});

// Full theme probability decomposition.
const career = await client.vedic.probability(chart.id, HouseSignificator.CAREER);
```

Every Vedic method returns `Record<string, unknown>` — the engine
output is deeply structured JSON that is more naturally indexed
than matched against a typed model. A runtime `ensureDict` guard
guarantees the response IS an object.

## Error handling

```ts
import {
  RateLimitedError,
  AuthenticationError,
  BudgetExceededError,
  NotFoundError,
  ServerError,
} from "@astrolinkers/sdk-ts";

try {
  const reading = await client.llm.chartReading({ chartId: "bogus", tier: "premium" });
} catch (err) {
  if (err instanceof NotFoundError) /* … */ ;
  else if (err instanceof RateLimitedError) {
    console.log(`Slow down for ${err.retryAfterSeconds}s`);
  } else if (err instanceof BudgetExceededError) {
    console.log(`Budget hit: $${err.spentUsd} of $${err.capUsd}`);
  } else if (err instanceof AuthenticationError) /* … */ ;
  else if (err instanceof ServerError) /* … */ ;
  else throw err;
}
```

## Escape hatch

For any endpoint the SDK does not yet wrap, the typed client still
gives you authenticated requests with the same retry / error-mapping
behaviour:

```ts
const data = await client.request<{ items: unknown[] }>("GET", "/v1/some-new-endpoint", {
  params: { x: 1 },
});

const response = await client.stream("POST", "/v1/some-stream");
for await (const chunk of response.body!) {
  // …
}
```

## Configuration

| Option            | Default                        | Notes                                                   |
| ----------------- | ------------------------------ | ------------------------------------------------------- |
| `apiKey`          | —                              | Required. Bearer token issued by Astrolinkers.          |
| `baseUrl`         | `https://api.astrolinkers.com` | Override for staging / self-hosted.                     |
| `timeoutMs`       | `60_000`                       | Connect / write timeout.                                |
| `readTimeoutMs`   | `300_000`                      | Long for premium streams. `null` disables.              |
| `maxRetries`      | `2`                            | Transient 5xx / connection. 429 honours `Retry-After`.  |
| `userAgentSuffix` | —                              | Appended to `User-Agent` for server-side correlation.   |
| `fetch`           | global `fetch`                 | Inject a custom impl (tests, edge runtimes, telemetry). |

## Versioning

Semantic versioning. Until `1.0` minor releases may carry breaking
changes; pin your minor (`"@astrolinkers/sdk-ts": "~0.1"`) and bump
deliberately.

## License

MIT — see [LICENSE](LICENSE).
