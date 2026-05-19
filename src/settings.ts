/**
 * Client configuration container.
 *
 * Settings are passed by keyword to the `Astrolinkers` constructor.
 * Defaults mirror the production API so a one-line
 * `new Astrolinkers({ apiKey })` is enough for the common case.
 */

export const DEFAULT_BASE_URL = "https://api.astrolinkers.com";
export const DEFAULT_TIMEOUT_MS = 60_000;
// Streaming and premium-tier LLM calls can take 2+ minutes; the read
// deadline is set high so the client does not abort a legitimate
// long-running response.
export const DEFAULT_READ_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_RETRIES = 2;

/**
 * Immutable client configuration. Validation is performed in
 * {@link normaliseSettings}; the resulting object is treated as
 * read-only by the rest of the SDK.
 */
export interface ClientSettings {
  /** Bearer token issued by the Astrolinkers control plane. */
  apiKey: string;
  /** API root, without a trailing slash. Override only for non-prod. */
  baseUrl?: string;
  /** Per-request connect / write timeout in milliseconds. */
  timeoutMs?: number;
  /**
   * Read timeout in milliseconds — applies to long streaming
   * responses. Set to `null` to disable the read deadline.
   */
  readTimeoutMs?: number | null;
  /**
   * How many times the transport may retry a transient failure
   * (connection / 5xx) before giving up. `0` disables retry. `429`
   * always honours `Retry-After` and does not count against this
   * budget.
   */
  maxRetries?: number;
  /**
   * Extra token appended to the SDK's `User-Agent` header. Useful
   * when embedding the SDK in a higher-level product.
   */
  userAgentSuffix?: string;
  /**
   * Custom `fetch` implementation. Defaults to global `fetch`.
   * Tests can inject a mock; consumers can wire their own
   * instrumented implementation.
   */
  fetch?: typeof globalThis.fetch;
}

/** Frozen, fully-resolved settings used by every internal call site. */
export interface ResolvedSettings {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly readTimeoutMs: number | null;
  readonly maxRetries: number;
  readonly userAgentSuffix: string | undefined;
  readonly fetch: typeof globalThis.fetch;
}

/**
 * Validate user-supplied settings and apply defaults.
 *
 * Throws a `TypeError` on invalid input so misconfiguration fails
 * loudly at construction time instead of on the first request.
 */
export function normaliseSettings(settings: ClientSettings): ResolvedSettings {
  if (!settings.apiKey) {
    throw new TypeError("apiKey must be a non-empty string");
  }
  const baseUrl = settings.baseUrl ?? DEFAULT_BASE_URL;
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    throw new TypeError("baseUrl must start with http:// or https://");
  }
  const timeoutMs = settings.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be positive");
  }
  const readTimeoutMs =
    settings.readTimeoutMs === undefined ? DEFAULT_READ_TIMEOUT_MS : settings.readTimeoutMs;
  if (readTimeoutMs !== null && readTimeoutMs <= 0) {
    throw new TypeError("readTimeoutMs must be positive or null");
  }
  const maxRetries = settings.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (maxRetries < 0) {
    throw new TypeError("maxRetries must be >= 0");
  }
  const fetchImpl: typeof globalThis.fetch = settings.fetch ?? globalThis.fetch.bind(globalThis);
  return Object.freeze({
    apiKey: settings.apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    timeoutMs,
    readTimeoutMs,
    maxRetries,
    userAgentSuffix: settings.userAgentSuffix,
    fetch: fetchImpl,
  });
}
