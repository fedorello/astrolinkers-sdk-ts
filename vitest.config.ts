import { defineConfig } from "vitest/config";

// Default vitest run targets the unit suite only. The live e2e suite
// (`tests/e2e/**`) is opt-in via `pnpm test:e2e` so CI does not burn
// real budget. The e2e config lives next door in `vitest.e2e.config.ts`.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
