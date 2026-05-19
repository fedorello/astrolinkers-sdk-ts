/**
 * HTTP transport layer.
 *
 * Wraps the global `fetch` with:
 *
 * - Authenticated default headers (`Authorization: Bearer …`,
 *   `User-Agent: astrolinkers-typescript/<version> …`).
 * - Connect / read timeouts via `AbortController`.
 * - Exponential backoff with full jitter on transient failures.
 * - Translation of HTTP errors into the typed
 *   {@link AstrolinkersError} hierarchy.
 *
 * Resources never call `fetch` directly — they go through
 * {@link Transport}. This keeps the HTTP backend swappable (tests
 * inject a mocked `fetch`; advanced users can wire their own
 * instrumented implementation) without touching the public API.
 */

import {
  type APIErrorEnvelope,
  APIError,
  AuthenticationError,
  BudgetExceededError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitedError,
  ServerError,
  TimeoutError,
} from "./errors.js";
import type { ResolvedSettings } from "./settings.js";
import { VERSION } from "./version.js";

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504]);
const BUDGET_ERROR_CODES: ReadonlySet<string> = new Set(["llm_budget_exceeded", "budget_exceeded"]);

const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 4_000;

/** Query string value types acceptable from resources. */
export type QueryValue = string | number | boolean | null | undefined;

/** Optional per-call overrides. */
export interface RequestOptions {
  params?: Record<string, QueryValue> | undefined;
  json?: unknown;
  headers?: Record<string, string> | undefined;
  /** Override the connect / write deadline for one call (ms). */
  timeoutMs?: number | undefined;
  /** Override the read deadline (ms). `null` to disable. */
  readTimeoutMs?: number | null | undefined;
  /** Hint for the transport that this is a streaming response. */
  stream?: boolean | undefined;
}

/** Pre-built request used both by `request()` and `stream()`. */
interface PreparedRequest {
  url: string;
  init: RequestInit;
}

/** Sleep helper backed by `setTimeout`; promisified for `await`. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Compute the delay before the next retry — full-jitter exponential. */
function backoffMs(attempt: number): number {
  const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  return Math.random() * cap;
}

function buildUserAgent(suffix: string | undefined): string {
  const base = `astrolinkers-typescript/${VERSION}`;
  return suffix ? `${base} ${suffix}` : base;
}

function buildQueryString(params: Record<string, QueryValue> | undefined): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (value === false) continue; // Omit explicit `false` flags; the
    // server treats absence as the default-`false` case.
    usp.append(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

function parseRetryAfter(
  response: Response,
  details: Record<string, unknown> | undefined,
): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header !== null) {
    const numeric = Number(header);
    if (!Number.isNaN(numeric)) return numeric;
  }
  if (details) {
    const fromBody = details.retry_after_seconds;
    if (typeof fromBody === "number") return fromBody;
  }
  return undefined;
}

async function parseErrorEnvelope(response: Response): Promise<APIError> {
  const status = response.status;
  let code = "http_error";
  let message = response.statusText || "Request failed";
  let messageKey: string | undefined;
  let details: Record<string, unknown> | undefined;
  let requestId: string | undefined = response.headers.get("X-Request-Id") ?? undefined;

  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const env = body.error;
      if (env && typeof env === "object") {
        const envObj = env as Record<string, unknown>;
        if (typeof envObj.code === "string") code = envObj.code;
        if (typeof envObj.message === "string") message = envObj.message;
        if (typeof envObj.message_key === "string") messageKey = envObj.message_key;
        if (envObj.details && typeof envObj.details === "object") {
          details = envObj.details as Record<string, unknown>;
        }
        if (typeof envObj.request_id === "string") requestId = envObj.request_id;
      }
    }
  } catch {
    // Non-JSON body (CDN error page, plaintext) — use the defaults
    // computed above.
  }

  const envelope: APIErrorEnvelope = {
    statusCode: status,
    code,
    message,
    messageKey,
    details,
    requestId,
  };

  if (BUDGET_ERROR_CODES.has(code)) return new BudgetExceededError(envelope);
  switch (status) {
    case 401:
      return new AuthenticationError(envelope);
    case 403:
      return new PermissionDeniedError(envelope);
    case 404:
      return new NotFoundError(envelope);
    case 429: {
      const retryAfter = parseRetryAfter(response, details);
      return new RateLimitedError(envelope, retryAfter);
    }
    default: {
      if (status >= 400 && status < 500) return new InvalidRequestError(envelope);
      if (status >= 500 && status < 600) return new ServerError(envelope);
      return new APIError(envelope);
    }
  }
}

/** HTTP transport. One instance per `Astrolinkers` client. */
export class Transport {
  constructor(private readonly settings: ResolvedSettings) {}

  /**
   * Issue a JSON request and return the parsed body.
   *
   * Returns `undefined` for 204 / empty responses. Throws a typed
   * {@link AstrolinkersError} on any failure.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T | undefined> {
    const response = await this.sendWithRetry(method, path, options);
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new APIError({
        statusCode: response.status,
        code: "invalid_response",
        message: `Server returned non-JSON body (${String(text.length)} bytes).`,
        details: { cause: String(err) },
      });
    }
  }

  /**
   * Issue a request that returns a streaming response. The caller is
   * responsible for draining `response.body`; the transport only
   * handles the open phase (retry, error translation, headers).
   */
  async stream(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    return this.sendWithRetry(method, path, { ...options, stream: true });
  }

  private prepare(method: string, path: string, options: RequestOptions): PreparedRequest {
    const url = this.settings.baseUrl + path + buildQueryString(options.params);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.settings.apiKey}`,
      "User-Agent": buildUserAgent(this.settings.userAgentSuffix),
      Accept: options.stream === true ? "text/event-stream" : "application/json",
      ...(options.headers ?? {}),
    };
    const init: RequestInit = {
      method,
      headers,
    };
    if (options.json !== undefined) {
      init.body = JSON.stringify(options.json);
      headers["Content-Type"] = "application/json";
    }
    return { url, init };
  }

  private async sendWithRetry(
    method: string,
    path: string,
    options: RequestOptions,
  ): Promise<Response> {
    const { url, init } = this.prepare(method, path, options);
    let attempt = 0;
    // Each iteration either returns a successful response, throws on
    // an unrecoverable failure, or `continue`s with a back-off. There
    // is no static exit condition — the loop's exit is via `return` /
    // `throw` inside the body.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      attempt += 1;
      const abort = new AbortController();
      const connectTimer = setTimeout(() => {
        abort.abort(new TimeoutError("Connect / write deadline elapsed"));
      }, options.timeoutMs ?? this.settings.timeoutMs);
      let response: Response;
      try {
        response = await this.settings.fetch(url, {
          ...init,
          signal: abort.signal,
        });
      } catch (err) {
        clearTimeout(connectTimer);
        if (err instanceof TimeoutError) {
          if (attempt > this.settings.maxRetries) throw err;
          await sleep(backoffMs(attempt));
          continue;
        }
        const wrapped = new ConnectionError(err instanceof Error ? err.message : String(err));
        if (attempt > this.settings.maxRetries) throw wrapped;
        await sleep(backoffMs(attempt));
        continue;
      } finally {
        clearTimeout(connectTimer);
      }

      if (response.status >= 400) {
        if (attempt <= this.settings.maxRetries && RETRYABLE_STATUSES.has(response.status)) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw await parseErrorEnvelope(response);
      }

      return response;
    }
  }
}
