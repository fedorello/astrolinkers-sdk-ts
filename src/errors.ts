/**
 * Typed exception hierarchy raised by the SDK.
 *
 * The hierarchy mirrors the HTTP semantics so callers can pattern-match
 * on a specific failure mode without parsing strings:
 *
 * - {@link AstrolinkersError}      — base for every SDK error.
 * - {@link APIError}               — server replied with an error
 *   envelope; subclasses below pick the right HTTP status range.
 * - {@link AuthenticationError}    — 401.
 * - {@link PermissionDeniedError}  — 403.
 * - {@link NotFoundError}          — 404.
 * - {@link InvalidRequestError}    — 422 / other 4xx without a more
 *   specific subclass.
 * - {@link RateLimitedError}       — 429, carries `retryAfterSeconds`.
 * - {@link BudgetExceededError}    — 402 / 429 cost-cap breach
 *   (carries `capUsd` / `spentUsd`).
 * - {@link ServerError}            — 5xx.
 * - {@link ConnectionError}        — TCP/TLS/DNS or aborted connection.
 * - {@link TimeoutError}           — request or read deadline elapsed.
 *
 * The transport layer maps every failure into one of these so the
 * public API never leaks raw `fetch` exceptions.
 */

/** Base class for every SDK exception. */
export class AstrolinkersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AstrolinkersError";
  }
}

/** Shape of the structured error envelope returned by the API. */
export interface APIErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  messageKey?: string | undefined;
  details?: Record<string, unknown> | undefined;
  requestId?: string | undefined;
}

/** Server replied with a structured error envelope. */
export class APIError extends AstrolinkersError implements APIErrorEnvelope {
  readonly statusCode: number;
  readonly code: string;
  readonly messageKey: string | undefined;
  readonly details: Record<string, unknown>;
  readonly requestId: string | undefined;

  constructor(envelope: APIErrorEnvelope) {
    super(`[${String(envelope.statusCode)} ${envelope.code}] ${envelope.message}`);
    this.name = "APIError";
    this.statusCode = envelope.statusCode;
    this.code = envelope.code;
    this.messageKey = envelope.messageKey;
    this.details = envelope.details ?? {};
    this.requestId = envelope.requestId;
  }
}

/** HTTP 401 — missing or invalid bearer token. */
export class AuthenticationError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "AuthenticationError";
  }
}

/** HTTP 403 — token lacks the required scope. */
export class PermissionDeniedError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "PermissionDeniedError";
  }
}

/**
 * HTTP 404 — the requested resource does not exist (or is not visible
 * to the calling tenant; the API returns 404 in both cases on purpose).
 */
export class NotFoundError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "NotFoundError";
  }
}

/** HTTP 4xx other than the above — usually 422 validation errors. */
export class InvalidRequestError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "InvalidRequestError";
  }
}

/** HTTP 429 — per-tenant / per-tier rate limit hit. */
export class RateLimitedError extends APIError {
  /**
   * Pulled from the `Retry-After` header first; falls back to
   * `details.retry_after_seconds` from the body.
   */
  readonly retryAfterSeconds: number | undefined;

  constructor(envelope: APIErrorEnvelope, retryAfterSeconds: number | undefined) {
    super(envelope);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * The tenant's rolling LLM spend cap was exhausted.
 *
 * Carries `capUsd` and `spentUsd` when the server provides them, so
 * the caller can show the user a top-up prompt with the real numbers.
 */
export class BudgetExceededError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "BudgetExceededError";
  }

  get capUsd(): number | undefined {
    const value = this.details.cap_usd;
    return typeof value === "number" ? value : undefined;
  }

  get spentUsd(): number | undefined {
    const value = this.details.spent_usd;
    return typeof value === "number" ? value : undefined;
  }
}

/** HTTP 5xx — server-side failure, retryable. */
export class ServerError extends APIError {
  constructor(envelope: APIErrorEnvelope) {
    super(envelope);
    this.name = "ServerError";
  }
}

/** Underlying network failed before the response could be read. */
export class ConnectionError extends AstrolinkersError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

/** Request, connection, or read deadline elapsed. */
export class TimeoutError extends AstrolinkersError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}
