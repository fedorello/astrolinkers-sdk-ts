/** LLM streaming — SSE parsing into typed events. */

import { beforeEach, describe, expect, it } from "vitest";

import { FakeFetch, newClient } from "./setup.js";
import type { InterpretationStreamEvent } from "../src/index.js";

function sseBody(): string {
  return (
    "event: meta\n" +
    'data: {"kind":"meta","interpretation_type":"theme","language":"en",' +
    '"tier":"basic","engine_context":{"theme":"career"}}\n\n' +
    "event: delta\n" +
    'data: {"kind":"delta","content":"Hello "}\n\n' +
    "event: delta\n" +
    'data: {"kind":"delta","content":"world"}\n\n' +
    "event: done\n" +
    'data: {"kind":"done","input_tokens":100,"output_tokens":250,' +
    '"latency_ms":4200,"cost_usd":0.0021,"interpretation_id":"i-1","cached":false}\n\n'
  );
}

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

let fake: FakeFetch;

beforeEach(() => {
  fake = new FakeFetch();
});

describe("themeStream", () => {
  it("parses meta + delta + done in order", async () => {
    fake.on("POST", "/v1/llm/theme/career/stream", () => sseResponse(sseBody()));
    const client = newClient(fake);
    const events: InterpretationStreamEvent[] = [];
    for await (const ev of client.llm.themeStream({ chartId: "c1", theme: "career" })) {
      events.push(ev);
    }
    expect(events.map((e) => e.kind)).toEqual(["meta", "delta", "delta", "done"]);
    const deltaText = events
      .filter((e): e is Extract<InterpretationStreamEvent, { kind: "delta" }> => e.kind === "delta")
      .map((e) => e.content)
      .join("");
    expect(deltaText).toBe("Hello world");
    const done = events.at(-1)!;
    expect(done.kind).toBe("done");
    if (done.kind === "done") {
      expect(done.input_tokens).toBe(100);
      expect(done.interpretation_id).toBe("i-1");
    }
  });

  it("terminates on error event without emitting done", async () => {
    const stream =
      "event: meta\n" +
      'data: {"kind":"meta","interpretation_type":"theme","language":"en",' +
      '"tier":"basic","engine_context":{}}\n\n' +
      "event: delta\n" +
      'data: {"kind":"delta","content":"partial"}\n\n' +
      "event: error\n" +
      'data: {"kind":"error","error":"upstream blew up"}\n\n';
    fake.on("POST", "/v1/llm/theme/career/stream", () => sseResponse(stream));
    const client = newClient(fake);
    const events: InterpretationStreamEvent[] = [];
    for await (const ev of client.llm.themeStream({ chartId: "c1", theme: "career" })) {
      events.push(ev);
    }
    expect(events.at(-1)?.kind).toBe("error");
    expect(events.find((e) => e.kind === "done")).toBeUndefined();
  });
});
