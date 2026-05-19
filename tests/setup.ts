/**
 * Test harness — a `FakeFetch` injected via `ClientSettings.fetch`.
 *
 * Following the in-memory-fake-not-mock pattern: tests build a
 * lightweight `FakeFetch` that records calls and serves canned
 * responses, then construct `Astrolinkers` with `fetch: fake.fetch`.
 * This avoids any global state (no MSW, no module monkey-patching)
 * and stays compatible with Node, Bun, and the browser.
 */

import { Astrolinkers } from "../src/index.js";

export const BASE_URL = "https://api.test.astrolinkers.com";
export const TEST_API_KEY = "alk_test_token";

/** Recorded call captured by {@link FakeFetch}. */
export interface RecordedRequest {
  method: string;
  url: string;
  headers: Headers;
  body: string | undefined;
}

/** Handler matches a method + URL prefix and returns a `Response`. */
export interface FakeHandler {
  method: string;
  /** Match against the full URL (string contains check). */
  url: string;
  respond: (req: RecordedRequest) => Response | Promise<Response>;
}

/**
 * Minimal fake `fetch` keyed by method + URL prefix. The first
 * matching handler wins. Unmatched calls throw so tests fail loudly
 * instead of silently hitting the real network.
 */
export class FakeFetch {
  private handlers: FakeHandler[] = [];
  readonly calls: RecordedRequest[] = [];

  /** Register a handler. Returns `this` for chaining. */
  on(method: string, url: string, respond: FakeHandler["respond"]): this {
    this.handlers.push({ method: method.toUpperCase(), url, respond });
    return this;
  }

  /** Reset between tests so handlers from prior cases do not leak. */
  reset(): void {
    this.handlers = [];
    this.calls.length = 0;
  }

  /** The `fetch` impl injected into `ClientSettings`. */
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    // Body is only stringified when it is already a string (the SDK
    // always JSON-encodes before calling `fetch`); for any other
    // BodyInit we leave it `undefined` rather than risking a
    // `[object Object]` artifact.
    const body = typeof init?.body === "string" ? init.body : undefined;
    const recorded: RecordedRequest = { method, url, headers, body };
    this.calls.push(recorded);
    for (const handler of this.handlers) {
      if (handler.method === method && url.includes(handler.url)) {
        return handler.respond(recorded);
      }
    }
    throw new Error(`FakeFetch: no handler for ${method} ${url}`);
  };
}

/** Construct a client that routes every request through `fake`. */
export function newClient(fake: FakeFetch): Astrolinkers {
  return new Astrolinkers({
    apiKey: TEST_API_KEY,
    baseUrl: BASE_URL,
    maxRetries: 0,
    fetch: fake.fetch,
  });
}

/** JSON-body helper. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  // Build the headers object explicitly — spreading `ResponseInit` is
  // safe in general, but `eslint-plugin-typescript` flags it because
  // `headers` can be a `HeadersInit` (which is an array union).
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const merged = new Headers(baseHeaders);
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      merged.set(key, value);
    });
  }
  const responseInit: ResponseInit = { headers: merged };
  if (init.status !== undefined) responseInit.status = init.status;
  if (init.statusText !== undefined) responseInit.statusText = init.statusText;
  return new Response(JSON.stringify(body), responseInit);
}
