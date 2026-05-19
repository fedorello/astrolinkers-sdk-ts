/**
 * Zod schemas for LLM interpretations + the streaming protocol.
 *
 * The streaming event union is discriminated on `kind` so callers
 * can narrow exhaustively in a `switch`.
 */

import { z } from "zod";

const ZLanguage = z.enum(["en", "hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "es"]);
const ZTier = z.enum(["basic", "standard", "premium"]);
const ZType = z.enum(["theme", "chart_reading", "dasha_forecast", "muhurta"]);

export const LLMInterpretationSchema = z
  .object({
    interpretation_type: ZType,
    language: ZLanguage,
    tier: ZTier,
    content: z.string(),
    engine_context: z.record(z.string(), z.unknown()).default({}),
    input_tokens: z.number().int().default(0),
    output_tokens: z.number().int().default(0),
    latency_ms: z.number().int().default(0),
    cost_usd: z.number().default(0),
    interpretation_id: z.string().default(""),
    cached: z.boolean().default(false),
  })
  .loose();
export type LLMInterpretation = z.infer<typeof LLMInterpretationSchema>;

export const StoredLLMInterpretationSchema = z
  .object({
    id: z.string(),
    chart_id: z.string(),
    interpretation_type: ZType,
    theme: z.string().nullable().optional(),
    language: ZLanguage,
    tier: ZTier,
    content: z.string(),
    engine_context: z.record(z.string(), z.unknown()).default({}),
    request_params: z.record(z.string(), z.unknown()).default({}),
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
    latency_ms: z.number().int(),
    cost_usd: z.number(),
    created_at: z.coerce.date(),
  })
  .loose();
export type StoredLLMInterpretation = z.infer<typeof StoredLLMInterpretationSchema>;

export const InterpretationListPageSchema = z
  .object({
    items: z.array(StoredLLMInterpretationSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .loose();
export type InterpretationListPage = z.infer<typeof InterpretationListPageSchema>;

// ── Streaming events ─────────────────────────────────────────────

export const MetaEventSchema = z
  .object({
    kind: z.literal("meta"),
    interpretation_type: ZType,
    language: ZLanguage,
    tier: ZTier,
    engine_context: z.record(z.string(), z.unknown()).default({}),
  })
  .loose();
export type MetaEvent = z.infer<typeof MetaEventSchema>;

export const DeltaEventSchema = z
  .object({
    kind: z.literal("delta"),
    content: z.string(),
  })
  .loose();
export type DeltaEvent = z.infer<typeof DeltaEventSchema>;

export const DoneEventSchema = z
  .object({
    kind: z.literal("done"),
    input_tokens: z.number().int().default(0),
    output_tokens: z.number().int().default(0),
    latency_ms: z.number().int().default(0),
    cost_usd: z.number().default(0),
    interpretation_id: z.string().default(""),
    cached: z.boolean().default(false),
  })
  .loose();
export type DoneEvent = z.infer<typeof DoneEventSchema>;

export const ErrorEventSchema = z
  .object({
    kind: z.literal("error"),
    error: z.string().nullable().optional(),
  })
  .loose();
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/** Union of every event type emitted by an LLM stream. */
export type InterpretationStreamEvent = MetaEvent | DeltaEvent | DoneEvent | ErrorEvent;
