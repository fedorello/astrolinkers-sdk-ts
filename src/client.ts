/**
 * Public client facade.
 *
 * One class — `Astrolinkers` — with resources hung off it. Because
 * JavaScript / TypeScript has no sync HTTP, there is no separate
 * sync mirror like the Python SDK; every method returns a Promise.
 *
 * Usage:
 *
 * ```ts
 * import { Astrolinkers } from "astrolinkers-sdk";
 *
 * const client = new Astrolinkers({ apiKey: "alk_live_…" });
 * const chart = await client.charts.create({
 *   moment: new Date("1990-04-15T02:00:00Z"),
 *   latitude: 28.6139,
 *   longitude: 77.2090,
 *   timezone: "Asia/Kolkata",
 * });
 * const reading = await client.llm.chartReading({
 *   chartId: chart.id,
 *   tier: "premium",
 * });
 * console.log(reading.content);
 * ```
 */

import { type ClientSettings, normaliseSettings } from "./settings.js";
import { type QueryValue, type RequestOptions, Transport } from "./transport.js";
import { ApiKeys } from "./resources/api-keys.js";
import { Charts } from "./resources/charts.js";
import { Compatibility } from "./resources/compatibility.js";
import { Feedback } from "./resources/feedback.js";
import { Health } from "./resources/health.js";
import { Interpretations } from "./resources/interpretations.js";
import { LLM } from "./resources/llm.js";
import { Plans } from "./resources/plans.js";
import { Profiles } from "./resources/profiles.js";
import { Reports } from "./resources/reports.js";
import { Usage } from "./resources/usage.js";
import { Vedic } from "./resources/vedic.js";

export class Astrolinkers {
  readonly apiKeys: ApiKeys;
  readonly charts: Charts;
  readonly compatibility: Compatibility;
  readonly feedback: Feedback;
  readonly health: Health;
  readonly interpretations: Interpretations;
  readonly llm: LLM;
  readonly plans: Plans;
  readonly profiles: Profiles;
  readonly reports: Reports;
  readonly usage: Usage;
  readonly vedic: Vedic;

  private readonly transport: Transport;

  constructor(settings: ClientSettings) {
    const resolved = normaliseSettings(settings);
    this.transport = new Transport(resolved);

    this.apiKeys = new ApiKeys(this.transport);
    this.charts = new Charts(this.transport);
    this.compatibility = new Compatibility(this.transport);
    this.feedback = new Feedback(this.transport);
    this.health = new Health(this.transport);
    this.interpretations = new Interpretations(this.transport);
    this.llm = new LLM(this.transport);
    this.plans = new Plans(this.transport);
    this.profiles = new Profiles(this.transport);
    this.reports = new Reports(this.transport);
    this.usage = new Usage(this.transport);
    this.vedic = new Vedic(this.transport);
  }

  /**
   * Escape hatch — make an arbitrary authenticated API call.
   *
   * Use this when a server endpoint exists that the SDK does not
   * wrap yet. Errors map into the same typed hierarchy as the
   * resource methods; the JSON body is parsed and returned as
   * `unknown` so callers narrow it themselves.
   *
   * Returns `undefined` for 204 / empty responses.
   */
  request<T = unknown>(
    method: string,
    path: string,
    options: {
      params?: Record<string, QueryValue>;
      json?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T | undefined> {
    const passthrough: RequestOptions = {};
    if (options.params !== undefined) passthrough.params = options.params;
    if (options.json !== undefined) passthrough.json = options.json;
    if (options.headers !== undefined) passthrough.headers = options.headers;
    return this.transport.request<T>(method, path, passthrough);
  }

  /**
   * Escape hatch for streaming responses. Returns the raw
   * `Response`; the caller drains the body (e.g. via
   * `response.body.getReader()` or `eventsource-parser`). Retries
   * + error mapping match {@link request}.
   */
  stream(
    method: string,
    path: string,
    options: {
      params?: Record<string, QueryValue>;
      json?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<Response> {
    const passthrough: RequestOptions = {};
    if (options.params !== undefined) passthrough.params = options.params;
    if (options.json !== undefined) passthrough.json = options.json;
    if (options.headers !== undefined) passthrough.headers = options.headers;
    return this.transport.stream(method, path, passthrough);
  }
}
