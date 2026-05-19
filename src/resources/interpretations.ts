/**
 * Template-driven interpretations.
 *
 * Wraps `POST /v1/interpretations` and `GET /v1/interpretations/{id}`
 * — the structured-statements flow with feedback loop. The
 * LLM-generated interpretations live on `client.llm` under
 * `listStored` / `retrieveStored` / `usageSummary`.
 */

import type { Transport } from "../transport.js";
import {
  type TemplateInterpretation,
  TemplateInterpretationSchema,
} from "../types/template-interpretations.js";

export type Locale = "en" | "hi" | "ru";
export type Tone = "corporate" | "coach" | "vedic_traditional" | "plain";

export interface CreateTemplateInterpretationParams {
  chartId: string;
  locale?: Locale;
  tone?: Tone;
  useLlmRewrite?: boolean;
}

export class Interpretations {
  constructor(private readonly transport: Transport) {}

  async create(params: CreateTemplateInterpretationParams): Promise<TemplateInterpretation> {
    const data = await this.transport.request("POST", "/v1/interpretations", {
      json: {
        chart_id: params.chartId,
        locale: params.locale ?? "en",
        tone: params.tone ?? "corporate",
        use_llm_rewrite: params.useLlmRewrite ?? false,
      },
    });
    return TemplateInterpretationSchema.parse(data);
  }

  async retrieve(interpretationId: string): Promise<TemplateInterpretation> {
    const data = await this.transport.request("GET", `/v1/interpretations/${interpretationId}`);
    return TemplateInterpretationSchema.parse(data);
  }
}
