# Changelog

All notable changes to this SDK are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## 0.1.1 — 2026-05-19

Schema-correctness release. Every non-Vedic typed response now matches
the real OpenAPI shape served by the API, so `.parse()` no longer
throws on valid responses. The previous release never worked for these
endpoints, so there are no compatibility shims — types are aligned
to the wire as-is.

### Charts

- `HouseCusp.house_number` renamed to `HouseCusp.house` to match the
  server payload.
- `PlanetPosition` now includes the required `sign`, `degree_in_sign`,
  `navamsa_sign`, `navamsa_lord` fields. `speed_per_day` and
  `is_retrograde` are now non-nullable (server always sends them).
- `BirthData` no longer carries `timezone` / `location_name` — these
  were never accepted by `POST /v1/charts`. The request builder no
  longer forwards them either.
- `Chart.metadata` removed (server does not return it).
- `HouseSystem` enum now contains `placidus | whole_sign | equal`
  only; `koch` was rejected by the server and is dropped.
- `AyanamshaType` enum reduced to `lahiri` only — server's
  `Literal["lahiri"] | None`. The resource signature still accepts
  `string | AyanamshaType` for forward compatibility.
- Default `house_system` on `POST /v1/charts` changed from
  `whole_sign` to `placidus` to match the server default.

### API keys

- `IssuedApiKeySchema` flattened to match the server's
  `IssuedApiKeyResponse` (`id, name, key_prefix, key_last4, display,
scopes, owner_tenant_id, created_at, created_by, last_used_at,
expires_at, revoked_at, metadata, plaintext`). The old
  `{ api_key, token }` wrapper never existed on the wire.
- `ApiKeySchema` extended with `key_prefix, key_last4, display,
owner_tenant_id, created_by`.
- `apiKeys.list()` now reads from the `keys` wrapper key (not
  `items`).

### Plans

- `plans.list()` now reads from the `plans` wrapper key (not
  `items`).
- `PlanSchema` rewritten to match server's `PlanResponse`:
  `tier, display_name, monthly_price_usd, rate_limit_capacity,
rate_limit_refill_per_second, llm_cost_cap_per_hour_usd (nullable),
status, features`. Dropped `name, monthly_call_cap, metadata`.
- `TenantPlanSchema` rewritten:
  `{ tenant_id, display_name, plan: Plan, plan_updated_at, created_at }`.
  Dropped the previous top-level `tier, activated_at, expires_at,
metadata`.

### Profiles

- `SkillProfileSchema` rewritten to `{ chart_id, scores: SkillScore[] }`
  where `SkillScore = { skill_id, value, level, contributing_rules }`,
  matching the server's `SkillProfileResponse`. Dropped the unused
  `locale/skills/strengths/risks/metadata` ghost fields.

### Reports

- `ReportSchema`: dropped `locale, tone, metadata` (server does not
  return them). Added `artifact_key (nullable)`. `updated_at` is now
  required and non-nullable (server always sends it).

### Template interpretations

- `Statement` renamed `text` → `body`, `confidence` → `score`. Added
  the server's required `kind, locale, rule_path, created_at`.
- `TemplateInterpretation` dropped the wrapper-level `created_at` and
  `metadata` fields (not on the wire).

### Usage buckets

- `HourlyUsageBucketSchema` rewritten to match the server:
  `bucket_hour, requests, errors_4xx, errors_5xx, latency_p95_ms
(nullable)`. Dropped the legacy `hour, request_count, success_count,
error_count, last_request_at` names.
- `HourlyUsageSchema` rewritten:
  `since, until, total_requests, total_errors, buckets`.

### LLM interpretations

- `LLMInterpretation.interpretation_type` widened from the strict
  `InterpretationType` enum to `InterpretationType | string` to
  survive future server-side variants.

### Notes

- No breaking changes to method signatures except `CreateChartParams`,
  which no longer accepts `timezone` / `locationName` (these were
  silently dropped by the server anyway).

## [0.1.0] — initial release

This release ships the full API surface — every public Astrolinkers
endpoint has a typed TypeScript method.

### Added

- **`Astrolinkers`** client (async-only — there is no sync HTTP in
  the JavaScript runtime). Constructed once per process and reused.

- **12 resource classes**, mirroring the Python SDK 1:1:
  - `client.charts` — compute + retrieve natal charts.
  - `client.llm` — 4 sync + 4 streaming LLM endpoints
    plus persistence reads (`listStored` / `retrieveStored` /
    `usageSummary`).
  - `client.interpretations` — template-driven flow.
  - `client.compatibility` — synastry + ashtakoota.
  - `client.feedback` — statement verdicts + template
    accuracy.
  - `client.profiles` — talent / hiring profile.
  - `client.reports` — async PDF / HTML pipeline.
  - `client.vedic` — every one of the 58 `/v1/vedic/...`
    engine endpoints.
  - `client.apiKeys` — issue / list / revoke own tokens.
  - `client.plans` — catalogue + tenant plan management.
  - `client.usage` — hourly API-call buckets.
  - `client.health` — `healthz` / `readyz` / `version`.

- **Escape hatches** `client.request(...)` and `client.stream(...)`
  for endpoints the SDK does not yet wrap. Same retry / error
  mapping as the resource methods.

- **Typed error hierarchy**: `AstrolinkersError` → `APIError` →
  `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`,
  `InvalidRequestError`, `RateLimitedError` (carries
  `retryAfterSeconds`), `BudgetExceededError` (carries `capUsd` /
  `spentUsd`), `ServerError`, `ConnectionError`, `TimeoutError`.

- **Streaming via async iterators** — `for await (const event of
client.llm.themeStream(...))` yields typed events
  (`MetaEvent`, `DeltaEvent`, `DoneEvent`, `ErrorEvent`) parsed by
  `eventsource-parser`.

- **Runtime validation with Zod** on every response shape, so users
  get fully typed objects instead of raw JSON.

- **Retry + jittered exponential backoff** on connection failures
  and 5xx; honours `Retry-After` on 429.

- **Dual ESM + CJS** output via tsdown with declaration maps.
  Browser, Node 18+, Bun, and Cloudflare Workers compatible.

- **`fetch` is injectable** via `ClientSettings.fetch` — tests use
  a tiny `FakeFetch` for in-memory verification, with no MSW or
  global service worker required.

### Quality gates

- ESLint v10 + typescript-eslint strict-type-checked — zero errors.
- Prettier — clean.
- TypeScript v6 strict (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, ...) — zero
  errors.
- Vitest 4 — 43 unit tests pass.
- CI matrix: Node 20 / 22 / 24 × Ubuntu / macOS.
