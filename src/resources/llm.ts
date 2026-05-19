/**
 * LLM interpretations resource.
 *
 * Covers all four `POST /v1/llm/...` sync endpoints, their `/stream`
 * siblings, plus persistence read (`list_stored` / `retrieve_stored` /
 * `usage_summary`).
 *
 * Streaming methods return an `AsyncIterable<InterpretationStreamEvent>`
 * so callers can write `for await (const event of …)` naturally.
 */

import { createParser, type EventSourceMessage } from "eventsource-parser";

import { APIError, AstrolinkersError } from "../errors.js";
import type { QueryValue, Transport } from "../transport.js";
import type { InterpretationTier, Language, UsageGroupBy } from "../types/enums.js";
import {
  DeltaEventSchema,
  DoneEventSchema,
  ErrorEventSchema,
  type ErrorEvent,
  type InterpretationListPage,
  InterpretationListPageSchema,
  type InterpretationStreamEvent,
  type LLMInterpretation,
  LLMInterpretationSchema,
  MetaEventSchema,
  type StoredLLMInterpretation,
  StoredLLMInterpretationSchema,
} from "../types/interpretations.js";
import { type UsageSummary, UsageSummarySchema } from "../types/usage.js";

// ─────────────────────────────────────────────────────────────────
// Shared param shapes
// ─────────────────────────────────────────────────────────────────

interface BaseLLMParams {
  chartId: string;
  language?: Language;
  tier?: InterpretationTier;
  fresh?: boolean;
}

export interface ThemeParams extends BaseLLMParams {
  theme: string;
  at?: Date | null;
}

export type ChartReadingParams = BaseLLMParams;

export interface DashaForecastParams extends BaseLLMParams {
  at: Date;
}

export interface MuhurtaParams extends BaseLLMParams {
  windowStart: Date;
  windowEnd: Date;
  intervalMinutes?: number;
  topN?: number;
}

export interface ListStoredParams {
  chartId?: string;
  interpretationType?: string;
  language?: Language;
  tier?: InterpretationTier;
  limit?: number;
  offset?: number;
}

export interface UsageSummaryParams {
  from: Date;
  to: Date;
  chartId?: string;
  interpretationType?: string;
  language?: Language;
  tier?: InterpretationTier;
  groupBy?: UsageGroupBy;
}

// ─────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────

function themeQuery(p: ThemeParams): Record<string, QueryValue> {
  return {
    chart_id: p.chartId,
    language: p.language ?? "en",
    tier: p.tier ?? "standard",
    at: p.at ? p.at.toISOString() : undefined,
    fresh: p.fresh ?? false,
  };
}

function chartReadingQuery(p: ChartReadingParams): Record<string, QueryValue> {
  return {
    chart_id: p.chartId,
    language: p.language ?? "en",
    tier: p.tier ?? "standard",
    fresh: p.fresh ?? false,
  };
}

function dashaQuery(p: DashaForecastParams): Record<string, QueryValue> {
  return {
    chart_id: p.chartId,
    language: p.language ?? "en",
    tier: p.tier ?? "standard",
    at: p.at.toISOString(),
    fresh: p.fresh ?? false,
  };
}

function muhurtaQuery(p: MuhurtaParams): Record<string, QueryValue> {
  return {
    chart_id: p.chartId,
    language: p.language ?? "en",
    tier: p.tier ?? "standard",
    window_start: p.windowStart.toISOString(),
    window_end: p.windowEnd.toISOString(),
    interval_minutes: p.intervalMinutes ?? 60,
    top_n: p.topN ?? 5,
    fresh: p.fresh ?? false,
  };
}

function listStoredQuery(p: ListStoredParams): Record<string, QueryValue> {
  return {
    chart_id: p.chartId,
    interpretation_type: p.interpretationType,
    language: p.language,
    tier: p.tier,
    limit: p.limit ?? 50,
    offset: p.offset ?? 0,
  };
}

function usageQuery(p: UsageSummaryParams): Record<string, QueryValue> {
  return {
    from: p.from.toISOString(),
    to: p.to.toISOString(),
    chart_id: p.chartId,
    interpretation_type: p.interpretationType,
    language: p.language,
    tier: p.tier,
    group_by: p.groupBy ?? "none",
  };
}

// ─────────────────────────────────────────────────────────────────
// SSE parsing
// ─────────────────────────────────────────────────────────────────

function parseStreamEvent(name: string, data: string): InterpretationStreamEvent {
  let payload: unknown = {};
  try {
    payload = data ? (JSON.parse(data) as unknown) : {};
  } catch (err) {
    return {
      kind: "error",
      error: `Malformed event payload: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (payload && typeof payload === "object" && "kind" in payload) {
    // Strip server-supplied `kind` so the literal in our schema
    // controls the discriminator.
    delete (payload as Record<string, unknown>).kind;
  }
  const withKind = { ...(payload as Record<string, unknown>), kind: name };
  switch (name) {
    case "meta":
      return MetaEventSchema.parse(withKind);
    case "delta":
      return DeltaEventSchema.parse(withKind);
    case "done":
      return DoneEventSchema.parse(withKind);
    case "error":
      return ErrorEventSchema.parse(withKind);
    default:
      return { kind: "error", error: `Unknown SSE event: ${name}` } satisfies ErrorEvent;
  }
}

async function* iterStream(response: Response): AsyncIterable<InterpretationStreamEvent> {
  if (!response.body) {
    yield { kind: "error", error: "Server returned an empty stream body" };
    return;
  }
  const decoder = new TextDecoder();
  const queue: InterpretationStreamEvent[] = [];
  let terminal = false;
  const parser = createParser({
    onEvent(event: EventSourceMessage): void {
      const ev = parseStreamEvent(event.event ?? "delta", event.data);
      queue.push(ev);
      if (ev.kind === "done" || ev.kind === "error") terminal = true;
    },
  });
  const reader = response.body.getReader();
  try {
    // Loop until the upstream body ends or a terminal event flips
    // `terminal`. ESLint cannot prove `terminal` mutates inside the
    // SSE parser callback, so we suppress the always-truthy hint.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!terminal) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      let next: InterpretationStreamEvent | undefined;
      while ((next = queue.shift()) !== undefined) {
        yield next;
        if (next.kind === "done" || next.kind === "error") return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────
// Resource
// ─────────────────────────────────────────────────────────────────

export class LLM {
  constructor(private readonly transport: Transport) {}

  // ── Non-streaming endpoints ─────────────────────────────────

  async theme(params: ThemeParams): Promise<LLMInterpretation> {
    const data = await this.transport.request("POST", `/v1/llm/theme/${params.theme}`, {
      params: themeQuery(params),
    });
    return LLMInterpretationSchema.parse(data);
  }

  async chartReading(params: ChartReadingParams): Promise<LLMInterpretation> {
    const data = await this.transport.request("POST", "/v1/llm/chart-reading", {
      params: chartReadingQuery(params),
    });
    return LLMInterpretationSchema.parse(data);
  }

  async dashaForecast(params: DashaForecastParams): Promise<LLMInterpretation> {
    const data = await this.transport.request("POST", "/v1/llm/dasha-forecast", {
      params: dashaQuery(params),
    });
    return LLMInterpretationSchema.parse(data);
  }

  async muhurtaReasoning(params: MuhurtaParams): Promise<LLMInterpretation> {
    const data = await this.transport.request("POST", "/v1/llm/muhurta-reasoning", {
      params: muhurtaQuery(params),
    });
    return LLMInterpretationSchema.parse(data);
  }

  // ── Streaming endpoints ─────────────────────────────────────

  themeStream(params: ThemeParams): AsyncIterable<InterpretationStreamEvent> {
    return this.openStream(`/v1/llm/theme/${params.theme}/stream`, themeQuery(params));
  }

  chartReadingStream(params: ChartReadingParams): AsyncIterable<InterpretationStreamEvent> {
    return this.openStream("/v1/llm/chart-reading/stream", chartReadingQuery(params));
  }

  dashaForecastStream(params: DashaForecastParams): AsyncIterable<InterpretationStreamEvent> {
    return this.openStream("/v1/llm/dasha-forecast/stream", dashaQuery(params));
  }

  muhurtaReasoningStream(params: MuhurtaParams): AsyncIterable<InterpretationStreamEvent> {
    return this.openStream("/v1/llm/muhurta-reasoning/stream", muhurtaQuery(params));
  }

  // ── Persistence: list / read past + usage summary ───────────

  async listStored(params: ListStoredParams = {}): Promise<InterpretationListPage> {
    const data = await this.transport.request("GET", "/v1/llm/interpretations", {
      params: listStoredQuery(params),
    });
    return InterpretationListPageSchema.parse(data);
  }

  async retrieveStored(interpretationId: string): Promise<StoredLLMInterpretation> {
    const data = await this.transport.request("GET", `/v1/llm/interpretations/${interpretationId}`);
    return StoredLLMInterpretationSchema.parse(data);
  }

  async usageSummary(params: UsageSummaryParams): Promise<UsageSummary> {
    const data = await this.transport.request("GET", "/v1/llm/usage-summary", {
      params: usageQuery(params),
    });
    return UsageSummarySchema.parse(data);
  }

  // ── Internals ───────────────────────────────────────────────

  private openStream(
    path: string,
    params: Record<string, QueryValue>,
  ): AsyncIterable<InterpretationStreamEvent> {
    const transport = this.transport;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<InterpretationStreamEvent> {
        try {
          const response = await transport.stream("POST", path, { params });
          yield* iterStream(response);
        } catch (err) {
          if (err instanceof APIError) throw err; // pre-stream — propagate.
          const message = err instanceof AstrolinkersError ? err.message : String(err);
          yield { kind: "error", error: message };
        }
      },
    };
  }
}
