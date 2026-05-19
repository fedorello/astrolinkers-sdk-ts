# Changelog

All notable changes to this SDK are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

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
