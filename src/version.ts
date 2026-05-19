/**
 * Single source of truth for the SDK version.
 *
 * Read at runtime to populate the `User-Agent` header so server-side
 * logs can correlate failures with a specific client version.
 */

// Keep in sync with `package.json`. When releasing, bump both.
export const VERSION = "0.1.0";
