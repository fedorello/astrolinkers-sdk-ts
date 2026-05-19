import { defineConfig } from "tsdown";

// Library build — dual ESM + CJS output, with `.d.ts` and `.d.cts`
// declaration files. Keeps the package usable from both modern
// `import` consumers and legacy `require` callers.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // The SDK ships its dependencies (httpx-style minimal surface) —
  // mark them external so they are resolved by the consumer.
  external: ["zod", "eventsource-parser"],
  target: "es2022",
});
