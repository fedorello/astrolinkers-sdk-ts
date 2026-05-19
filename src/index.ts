/**
 * Astrolinkers — official TypeScript SDK.
 *
 * Quick start:
 *
 * ```ts
 * import { Astrolinkers, InterpretationTier, Language } from "@astrolinkers/sdk-ts";
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
 *   tier: InterpretationTier.PREMIUM,
 *   language: Language.HI,
 * });
 * console.log(reading.content);
 * ```
 *
 * See https://docs.astrolinkers.com for the full API reference.
 */

// ── Client ──────────────────────────────────────────────────────
export { Astrolinkers } from "./client.js";
export { VERSION } from "./version.js";
export type { ClientSettings } from "./settings.js";

// ── Errors ──────────────────────────────────────────────────────
export {
  APIError,
  AstrolinkersError,
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
export type { APIErrorEnvelope } from "./errors.js";

// ── Core enums ──────────────────────────────────────────────────
export {
  AstrologySystem,
  AyanamshaType,
  HouseSystem,
  InterpretationTier,
  InterpretationType,
  Language,
  UsageGroupBy,
} from "./types/enums.js";

// ── Charts ──────────────────────────────────────────────────────
export {
  type BirthData,
  BirthDataSchema,
  type Chart,
  ChartSchema,
  type HouseCusp,
  HouseCuspSchema,
  type PlanetPosition,
  PlanetPositionSchema,
} from "./types/charts.js";
export type { CreateChartParams } from "./resources/charts.js";

// ── LLM interpretations ────────────────────────────────────────
export {
  type DeltaEvent,
  DeltaEventSchema,
  type DoneEvent,
  DoneEventSchema,
  type ErrorEvent,
  ErrorEventSchema,
  type InterpretationListPage,
  InterpretationListPageSchema,
  type InterpretationStreamEvent,
  type LLMInterpretation,
  LLMInterpretationSchema,
  type MetaEvent,
  MetaEventSchema,
  type StoredLLMInterpretation,
  StoredLLMInterpretationSchema,
} from "./types/interpretations.js";
export type {
  ChartReadingParams,
  DashaForecastParams,
  ListStoredParams,
  MuhurtaParams,
  ThemeParams,
  UsageSummaryParams,
} from "./resources/llm.js";

// ── Usage summary (LLM cost) ───────────────────────────────────
export {
  type UsageBucket,
  UsageBucketSchema,
  type UsageSummary,
  UsageSummarySchema,
} from "./types/usage.js";

// ── Template interpretations ───────────────────────────────────
export {
  type Statement,
  StatementSchema,
  type TemplateInterpretation,
  TemplateInterpretationSchema,
} from "./types/template-interpretations.js";
export type {
  CreateTemplateInterpretationParams,
  Locale,
  Tone,
} from "./resources/interpretations.js";

// ── Compatibility ──────────────────────────────────────────────
export {
  CompatibilityAxis,
  type CompatibilityReport,
  CompatibilityReportSchema,
} from "./types/compatibility.js";
export type { CreateCompatibilityParams } from "./resources/compatibility.js";

// ── Feedback ───────────────────────────────────────────────────
export {
  type FeedbackEntry,
  FeedbackEntrySchema,
  FeedbackRole,
  FeedbackVerdict,
  type TemplateAccuracy,
  TemplateAccuracySchema,
} from "./types/feedback.js";
export type { SubmitFeedbackParams } from "./resources/feedback.js";

// ── API keys ───────────────────────────────────────────────────
export {
  type ApiKey,
  ApiKeySchema,
  type IssuedApiKey,
  IssuedApiKeySchema,
} from "./types/api-keys.js";
export type { IssueApiKeyParams } from "./resources/api-keys.js";

// ── Plans ──────────────────────────────────────────────────────
export { type Plan, PlanSchema, type TenantPlan, TenantPlanSchema } from "./types/plans.js";

// ── Profiles ───────────────────────────────────────────────────
export { type SkillProfile, SkillProfileSchema } from "./types/profiles.js";

// ── Reports ────────────────────────────────────────────────────
export {
  type Report,
  ReportFormat,
  ReportKind,
  ReportSchema,
  ReportStatus,
} from "./types/reports.js";
export type { CreateReportParams } from "./resources/reports.js";

// ── Usage buckets (raw API hits) ───────────────────────────────
export {
  type HourlyUsage,
  HourlyUsageSchema,
  type HourlyUsageBucket,
  HourlyUsageBucketSchema,
} from "./types/usage-buckets.js";
export type { UsageWindow } from "./resources/usage.js";

// ── Vedic enums ────────────────────────────────────────────────
export {
  BhavaStyle,
  HouseSignificator,
  TheoArea,
  Varga,
  VimshopakaGroup,
} from "./types/vedic-enums.js";
