/** Settings validation. */

import { describe, expect, it } from "vitest";
import { Astrolinkers } from "../src/index.js";

describe("settings validation", () => {
  it("rejects empty apiKey", () => {
    expect(() => new Astrolinkers({ apiKey: "" })).toThrow(TypeError);
  });

  it("rejects non-http baseUrl", () => {
    expect(() => new Astrolinkers({ apiKey: "x", baseUrl: "ftp://x" })).toThrow(TypeError);
  });

  it("rejects negative timeout", () => {
    expect(() => new Astrolinkers({ apiKey: "x", timeoutMs: -1 })).toThrow(TypeError);
  });

  it("rejects negative maxRetries", () => {
    expect(() => new Astrolinkers({ apiKey: "x", maxRetries: -1 })).toThrow(TypeError);
  });

  it("accepts the minimum input", () => {
    const client = new Astrolinkers({ apiKey: "x" });
    expect(client.charts).toBeDefined();
  });
});
