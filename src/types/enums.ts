/**
 * Enumerations used across the API.
 *
 * Each enum is defined as a `const` object plus a string-union type
 * to give the best of both worlds: callers can write either the
 * symbolic constant (`Language.EN`) or the string literal (`"en"`),
 * and TypeScript will reject typos at compile time.
 */

/** ISO 639-1 codes the LLM endpoints accept. */
export const Language = {
  EN: "en",
  HI: "hi",
  TA: "ta",
  TE: "te",
  KN: "kn",
  ML: "ml",
  MR: "mr",
  BN: "bn",
  GU: "gu",
  ES: "es",
} as const;
export type Language = (typeof Language)[keyof typeof Language];

/** Depth-of-analysis tier for LLM interpretations. */
export const InterpretationTier = {
  BASIC: "basic",
  STANDARD: "standard",
  PREMIUM: "premium",
} as const;
export type InterpretationTier = (typeof InterpretationTier)[keyof typeof InterpretationTier];

/** Kind of LLM interpretation produced by the API. */
export const InterpretationType = {
  THEME: "theme",
  CHART_READING: "chart_reading",
  DASHA_FORECAST: "dasha_forecast",
  MUHURTA: "muhurta",
} as const;
export type InterpretationType = (typeof InterpretationType)[keyof typeof InterpretationType];

/** Tropical (western) vs sidereal (vedic) zodiac. */
export const AstrologySystem = {
  WESTERN: "western",
  VEDIC: "vedic",
} as const;
export type AstrologySystem = (typeof AstrologySystem)[keyof typeof AstrologySystem];

/** Sidereal offset used by the Vedic engine (most common values). */
export const AyanamshaType = {
  LAHIRI: "lahiri",
  RAMAN: "raman",
  KRISHNAMURTI: "krishnamurti",
} as const;
export type AyanamshaType = (typeof AyanamshaType)[keyof typeof AyanamshaType];

/** House-division convention. */
export const HouseSystem = {
  PLACIDUS: "placidus",
  WHOLE_SIGN: "whole_sign",
  EQUAL: "equal",
  KOCH: "koch",
} as const;
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];

/** Break-down dimension for `GET /v1/llm/usage-summary`. */
export const UsageGroupBy = {
  NONE: "none",
  INTERPRETATION_TYPE: "interpretation_type",
  TIER: "tier",
  LANGUAGE: "language",
  DAY: "day",
} as const;
export type UsageGroupBy = (typeof UsageGroupBy)[keyof typeof UsageGroupBy];
