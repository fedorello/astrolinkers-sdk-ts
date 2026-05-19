import { defineConfig } from "vitest/config";

// Live e2e config — hits the real staging API. Opt-in only:
// `pnpm test:e2e`. Skips cleanly when `ASTROLINKERS_E2E_TOKEN` is
// absent so engineers without the founder JWT do not see failures.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/e2e/**/*.test.ts"],
    // Real network calls — generous timeout for LLM endpoints, which
    // can take 60+ seconds on the standard tier.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Single fork: e2e flows depend on shared chart fixtures created
    // in `beforeAll`. Parallel forks would re-issue API keys and could
    // collide on rate limits.
    fileParallelism: false,
  },
});
