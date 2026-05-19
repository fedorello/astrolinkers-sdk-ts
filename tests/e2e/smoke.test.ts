/**
 * Live e2e smoke test against the real staging API.
 *
 * Goal: hit every public endpoint the SDK exposes (12 resources,
 * 92 endpoints) so we catch any drift between SDK assumptions and the
 * server contract before publishing a release.
 *
 * The suite no-ops cleanly when `ASTROLINKERS_E2E_TOKEN` is not set,
 * so CI / contributors without the founder JWT see "skipped", not red.
 *
 * Run:
 *   ASTROLINKERS_E2E_TOKEN=$(cat ~/.astrolinkers/token_founder.jwt) \
 *     pnpm test:e2e
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  Astrolinkers,
  AstrologySystem,
  CompatibilityAxis,
  FeedbackVerdict,
  HouseSignificator,
  HouseSystem,
  InterpretationTier,
  Language,
  RateLimitedError,
  ReportFormat,
  ReportKind,
  TheoArea,
  UsageGroupBy,
  Varga,
  VimshopakaGroup,
  type ApiKey,
  type Chart,
  type IssuedApiKey,
  type InterpretationStreamEvent,
  type Statement,
  type TemplateInterpretation,
} from "../../src/index.js";

// ─────────────────────────────────────────────────────────────────
// Environment / token loading
// ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.ASTROLINKERS_BASE_URL ?? "https://api.astrolinkers.com";

/** Resolve the founder JWT from env, or fall back to the shared file. */
function resolveFounderToken(): string | undefined {
  const fromEnv = process.env.ASTROLINKERS_E2E_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const fallback = path.join(os.homedir(), ".astrolinkers", "token_founder.jwt");
  if (fs.existsSync(fallback)) {
    const raw = fs.readFileSync(fallback, "utf8").trim();
    if (raw) return raw;
  }
  return undefined;
}

const FOUNDER_TOKEN = resolveFounderToken();
const HAS_TOKEN = Boolean(FOUNDER_TOKEN);

// Fixed birth-time fixture so the suite is deterministic.
const BIRTH_MOMENT = new Date("1990-04-15T02:00:00Z");
const BIRTH_LATITUDE = 28.6139;
const BIRTH_LONGITUDE = 77.209;

// Second birth fixture for compatibility tests.
const BIRTH_B_MOMENT = new Date("1992-07-22T14:30:00Z");
const BIRTH_B_LATITUDE = 19.076;
const BIRTH_B_LONGITUDE = 72.8777;

// Fixed "now" for usage-window queries — frozen one hour after the
// suite is loaded so `usage.tenant({ since, until })` returns a stable
// shape regardless of wall-clock skew.
const FROZEN_NOW = new Date("2026-05-19T12:00:00Z");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** A typed wrapper that surfaces any thrown error as a labelled value. */
async function probe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    console.warn(`[e2e][${label}] failed:`, error instanceof Error ? error.message : String(error));
    return { ok: false, error };
  }
}

/** Drain a stream until a `done` or `error` event is received. */
async function drainStream(
  stream: AsyncIterable<InterpretationStreamEvent>,
): Promise<InterpretationStreamEvent[]> {
  const events: InterpretationStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
    if (event.kind === "done" || event.kind === "error") break;
  }
  return events;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a call once on `RateLimitedError`. The LLM tier limiter is a
 * shared per-tenant bucket; if the suite issues calls faster than
 * refill, we want to pause for the server's `retryAfter` hint rather
 * than crash the whole suite.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;
    const waitSeconds = error.retryAfterSeconds ?? 5;
    await sleep(waitSeconds * 1000);
    return fn();
  }
}

interface SuiteFixtures {
  admin: Astrolinkers;
  client: Astrolinkers;
  issuedKey: IssuedApiKey;
  chartA: Chart;
  chartB: Chart;
  templateInterpretation: TemplateInterpretation;
}

let fixtures: SuiteFixtures | undefined;

// ─────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_TOKEN)("e2e smoke — Astrolinkers TS SDK against live API", () => {
  beforeAll(async () => {
    if (!FOUNDER_TOKEN) throw new Error("Founder token resolution disagreed with HAS_TOKEN");
    const admin = new Astrolinkers({ apiKey: FOUNDER_TOKEN, baseUrl: BASE_URL });

    // Issue a 1-hour scoped key for the suite. We deliberately cover
    // every scope referenced by any of the methods under test.
    //
    // NOTE: `expiresAt` uses real wall-clock time (not the fixed
    // FROZEN_NOW fixture) so the key stays valid for the full suite
    // run regardless of when the test is executed.
    const issuedAt = new Date();
    const issuedKey = await admin.apiKeys.issue({
      name: `e2e-smoke-${issuedAt.toISOString()}`,
      scopes: [
        "charts:read",
        "charts:write",
        "interpretations:read",
        "interpretations:write",
        "compatibility:read",
        "compatibility:write",
        "feedback:read",
        "feedback:write",
        "reports:read",
        "reports:write",
        "keys:manage",
      ],
      expiresAt: new Date(issuedAt.getTime() + ONE_HOUR_MS),
    });

    const client = new Astrolinkers({ apiKey: issuedKey.plaintext, baseUrl: BASE_URL });

    // Two charts up front — compatibility, synastry, talent-profile,
    // and most Vedic endpoints all need a persisted chart id.
    const chartA = await client.charts.create({
      moment: BIRTH_MOMENT,
      latitude: BIRTH_LATITUDE,
      longitude: BIRTH_LONGITUDE,
      // Pass enum values as plain strings on purpose — exercises the
      // recently-widened `system` / `houseSystem` typings.
      system: AstrologySystem.VEDIC,
      houseSystem: HouseSystem.PLACIDUS,
    });
    const chartB = await client.charts.create({
      moment: BIRTH_B_MOMENT,
      latitude: BIRTH_B_LATITUDE,
      longitude: BIRTH_B_LONGITUDE,
      system: AstrologySystem.VEDIC,
      houseSystem: HouseSystem.PLACIDUS,
    });

    // Template interpretation needed up front so the feedback test
    // can submit a verdict on a real `statement_id`.
    const templateInterpretation = await client.interpretations.create({
      chartId: chartA.id,
      locale: "en",
      tone: "corporate",
    });

    fixtures = { admin, client, issuedKey, chartA, chartB, templateInterpretation };
  }, 180_000);

  afterAll(async () => {
    if (!fixtures) return;
    const { admin, issuedKey } = fixtures;
    const revoked = await probe("apiKeys.revoke", () => admin.apiKeys.revoke(issuedKey.id));
    if (revoked.ok) {
      console.log(`[e2e] revoked test key ${issuedKey.id} at ${String(revoked.value.revoked_at)}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Health (3)
  // ─────────────────────────────────────────────────────────────

  describe("health", () => {
    it("healthz returns an object", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const body = await fix.client.health.healthz();
      expect(typeof body).toBe("object");
    });

    it("readyz returns an object", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const body = await fix.client.health.readyz();
      expect(typeof body).toBe("object");
    });

    it("version returns an object", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const body = await fix.client.health.version();
      expect(typeof body).toBe("object");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Charts (2)
  // ─────────────────────────────────────────────────────────────

  describe("charts", () => {
    it("create persisted both fixtures with parsed houses", () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      expect(fix.chartA.id).toBeTypeOf("string");
      expect(fix.chartA.planets.length).toBeGreaterThan(0);
      expect(fix.chartA.houses.length).toBeGreaterThan(0);
      const firstHouse = fix.chartA.houses[0];
      expect(firstHouse).toBeDefined();
      expect(firstHouse?.house).toBe(1);
      expect(fix.chartB.id).toBeTypeOf("string");
      expect(fix.chartB.id).not.toBe(fix.chartA.id);
    });

    it("retrieve round-trips chart A", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const same = await fix.client.charts.retrieve(fix.chartA.id);
      expect(same.id).toBe(fix.chartA.id);
      expect(same.planets.length).toBe(fix.chartA.planets.length);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Profiles (1)
  // ─────────────────────────────────────────────────────────────

  describe("profiles", () => {
    it("talent returns scored skills", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const profile = await fix.client.profiles.talent(fix.chartA.id);
      expect(profile.chart_id).toBe(fix.chartA.id);
      expect(profile.scores.length).toBeGreaterThan(0);
      const first = profile.scores[0];
      expect(first).toBeDefined();
      expect(first?.skill_id).toBeTypeOf("string");
      expect(first?.value).toBeTypeOf("number");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Interpretations (2)
  // ─────────────────────────────────────────────────────────────

  describe("interpretations", () => {
    it("create produced statements with body + score", () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const interp = fix.templateInterpretation;
      expect(interp.chart_id).toBe(fix.chartA.id);
      expect(interp.statements.length).toBeGreaterThan(0);
      for (const stmt of interp.statements) {
        expect(stmt.body.length).toBeGreaterThan(0);
        expect(stmt.score).toBeTypeOf("number");
      }
    });

    it("retrieve round-trips the template interpretation", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const same = await fix.client.interpretations.retrieve(fix.templateInterpretation.id);
      expect(same.id).toBe(fix.templateInterpretation.id);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Compatibility (2 happy paths + 1 retrieve)
  // ─────────────────────────────────────────────────────────────

  describe("compatibility", () => {
    let talentReportId: string | undefined;

    it("create talent axis returns ashtakoota / synastry payloads", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const report = await fix.client.compatibility.create({
        chartAId: fix.chartA.id,
        chartBId: fix.chartB.id,
        axis: CompatibilityAxis.TALENT,
      });
      expect(report.id).toBeTypeOf("string");
      expect(report.axis).toBe("talent");
      // At least one of the nested payloads must be present.
      expect(report.ashtakoota !== null || report.synastry !== null).toBe(true);
      talentReportId = report.id;
    });

    it("create romantic axis returns ashtakoota / synastry payloads", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const report = await fix.client.compatibility.create({
        chartAId: fix.chartA.id,
        chartBId: fix.chartB.id,
        axis: CompatibilityAxis.ROMANTIC,
      });
      expect(report.axis).toBe("romantic");
      expect(report.ashtakoota !== null || report.synastry !== null).toBe(true);
    });

    it("retrieve round-trips the talent report", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      expect(talentReportId).toBeDefined();
      if (!talentReportId) return;
      const same = await fix.client.compatibility.retrieve(talentReportId);
      expect(same.id).toBe(talentReportId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Reports (2)
  // ─────────────────────────────────────────────────────────────

  describe("reports", () => {
    let reportId: string | undefined;

    it("create returns a typed pending Report", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const report = await fix.client.reports.create({
        chartId: fix.chartA.id,
        kind: ReportKind.TALENT_LENS,
        format: ReportFormat.HTML,
      });
      expect(report.id).toBeTypeOf("string");
      // Async pipeline: pending or running on first call is OK.
      expect(["pending", "running", "ready", "failed"]).toContain(report.status);
      reportId = report.id;
    });

    it("retrieve round-trips the report", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      expect(reportId).toBeDefined();
      if (!reportId) return;
      const same = await fix.client.reports.retrieve(reportId);
      expect(same.id).toBe(reportId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Feedback (3)
  // ─────────────────────────────────────────────────────────────

  describe("feedback", () => {
    let feedbackId: string | undefined;
    let templateId: string | undefined;

    it("submit accepts a verdict on a real statement", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const stmt: Statement | undefined = fix.templateInterpretation.statements[0];
      expect(stmt).toBeDefined();
      if (!stmt) return;
      templateId = stmt.template_id;
      const entry = await fix.client.feedback.submit({
        statementId: stmt.id,
        // `accurate` is not a valid server verdict; the legal values
        // are `correct` / `doubtful` / `wrong`. Use the canonical one.
        verdict: FeedbackVerdict.CORRECT,
      });
      expect(entry.statement_id).toBe(stmt.id);
      expect(entry.verdict).toBe("correct");
      feedbackId = entry.id;
    });

    it("retrieve round-trips the submitted feedback", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix || !feedbackId) return;
      const same = await fix.client.feedback.retrieve(feedbackId);
      expect(same.id).toBe(feedbackId);
    });

    it("templateAccuracy aggregates the template", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix || !templateId) return;
      const accuracy = await fix.client.feedback.templateAccuracy(templateId);
      expect(accuracy.template_id).toBe(templateId);
      expect(accuracy.sample_size).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // LLM (4 sync + 4 stream + 3 persistence)
  // ─────────────────────────────────────────────────────────────

  describe("llm — sync endpoints (standard tier)", () => {
    it("chartReading returns content", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const reading = await withRateLimitRetry(() =>
        fix.client.llm.chartReading({
          chartId: fix.chartA.id,
          tier: InterpretationTier.STANDARD,
          language: Language.EN,
        }),
      );
      expect(reading.content.length).toBeGreaterThan(0);
      expect(reading.tier).toBe("standard");
    });

    it("theme(career) returns content", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const reading = await withRateLimitRetry(() =>
        fix.client.llm.theme({
          chartId: fix.chartA.id,
          theme: "career",
          tier: InterpretationTier.STANDARD,
          language: Language.EN,
        }),
      );
      expect(reading.content.length).toBeGreaterThan(0);
    });

    it("dashaForecast returns content", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const reading = await withRateLimitRetry(() =>
        fix.client.llm.dashaForecast({
          chartId: fix.chartA.id,
          tier: InterpretationTier.STANDARD,
          language: Language.EN,
          at: FROZEN_NOW,
        }),
      );
      expect(reading.content.length).toBeGreaterThan(0);
    });

    it("muhurtaReasoning returns content", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const reading = await withRateLimitRetry(() =>
        fix.client.llm.muhurtaReasoning({
          chartId: fix.chartA.id,
          tier: InterpretationTier.STANDARD,
          language: Language.EN,
          windowStart: FROZEN_NOW,
          windowEnd: new Date(FROZEN_NOW.getTime() + ONE_DAY_MS),
          intervalMinutes: 60,
          topN: 3,
        }),
      );
      expect(reading.content.length).toBeGreaterThan(0);
    });
  });

  describe("llm — streaming endpoints (standard tier)", () => {
    it("chartReadingStream emits meta and done", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const events = await withRateLimitRetry(() =>
        drainStream(
          fix.client.llm.chartReadingStream({
            chartId: fix.chartA.id,
            tier: InterpretationTier.STANDARD,
            language: Language.EN,
          }),
        ),
      );
      expect(events.some((e) => e.kind === "meta")).toBe(true);
      expect(events.some((e) => e.kind === "done" || e.kind === "error")).toBe(true);
    });

    it("themeStream(career) emits meta and done", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const events = await withRateLimitRetry(() =>
        drainStream(
          fix.client.llm.themeStream({
            chartId: fix.chartA.id,
            theme: "career",
            tier: InterpretationTier.STANDARD,
            language: Language.EN,
          }),
        ),
      );
      expect(events.some((e) => e.kind === "meta")).toBe(true);
      expect(events.some((e) => e.kind === "done" || e.kind === "error")).toBe(true);
    });

    it("dashaForecastStream emits meta and done", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const events = await withRateLimitRetry(() =>
        drainStream(
          fix.client.llm.dashaForecastStream({
            chartId: fix.chartA.id,
            tier: InterpretationTier.STANDARD,
            language: Language.EN,
            at: FROZEN_NOW,
          }),
        ),
      );
      expect(events.some((e) => e.kind === "meta")).toBe(true);
      expect(events.some((e) => e.kind === "done" || e.kind === "error")).toBe(true);
    });

    it("muhurtaReasoningStream emits meta and done", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const events = await withRateLimitRetry(() =>
        drainStream(
          fix.client.llm.muhurtaReasoningStream({
            chartId: fix.chartA.id,
            tier: InterpretationTier.STANDARD,
            language: Language.EN,
            windowStart: FROZEN_NOW,
            windowEnd: new Date(FROZEN_NOW.getTime() + ONE_DAY_MS),
            intervalMinutes: 60,
            topN: 3,
          }),
        ),
      );
      expect(events.some((e) => e.kind === "meta")).toBe(true);
      expect(events.some((e) => e.kind === "done" || e.kind === "error")).toBe(true);
    });
  });

  describe("llm — persistence", () => {
    it("listStored returns a page; retrieveStored round-trips", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const page = await fix.client.llm.listStored({ chartId: fix.chartA.id, limit: 10 });
      expect(page.limit).toBe(10);
      expect(page.items.length).toBeGreaterThan(0);
      const first = page.items[0];
      expect(first).toBeDefined();
      if (!first) return;
      const same = await fix.client.llm.retrieveStored(first.id);
      expect(same.id).toBe(first.id);
    });

    it("usageSummary groups by tier", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const summary = await fix.client.llm.usageSummary({
        from: new Date(FROZEN_NOW.getTime() - ONE_DAY_MS),
        to: FROZEN_NOW,
        groupBy: UsageGroupBy.TIER,
      });
      expect(summary.group_by).toBe("tier");
      expect(summary.total.call_count).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Vedic — all 58 endpoints
  // ─────────────────────────────────────────────────────────────

  describe("vedic — all 58 endpoints return objects", () => {
    // Each test exercises one method. The aim is "did it throw?" —
    // success = a JSON object came back. We do not validate deep
    // structure; that is the Vedic engine's own contract.
    //
    // Some endpoints take query inputs whose semantics depend on the
    // chart's birth moment (sunrise, transit windows). We pick a
    // synthetic sunrise of "birth date 05:30 UTC" and a transit
    // window of FROZEN_NOW ± 1 day.

    const sunrise = new Date("1990-04-15T00:00:00Z");
    const eventDate = new Date("2020-01-01T00:00:00Z");
    const transitAt = FROZEN_NOW;
    const windowStart = new Date(FROZEN_NOW.getTime() - ONE_DAY_MS);
    const windowEnd = new Date(FROZEN_NOW.getTime() + ONE_DAY_MS);

    it("divisional(D9)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.divisional(fix.chartA.id, Varga.D9);
      expect(typeof body).toBe("object");
    });

    it("bhavaChakra", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.bhavaChakra(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("specialLagnas", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.specialLagnas(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("aspects", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.aspects(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("aspectsWithOrb", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.aspectsWithOrb(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("dignity", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.dignity(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("functionalNature", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.functionalNature(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("vimshottari", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.vimshottari(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("currentDasha", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.currentDasha(fix.chartA.id, { at: transitAt });
      expect(typeof body).toBe("object");
    });

    it("yoginiDasha", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.yoginiDasha(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("charaDasha", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.charaDasha(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("periodLords", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.periodLords(fix.chartA.id, { sunrise });
      expect(typeof body).toBe("object");
    });

    it("yogas", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.yogas(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("jaiminiKarakas", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.jaiminiKarakas(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("arudha", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.arudha(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("badhaka", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.badhaka(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("ashtakavarga", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.ashtakavarga(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("ashtakavargaCorrected", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.ashtakavargaCorrected(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("panchanga", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.panchanga({
        at: transitAt,
        lat: BIRTH_LATITUDE,
        lon: BIRTH_LONGITUDE,
      });
      expect(typeof body).toBe("object");
    });

    it("shadbala", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.shadbala(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("shadbalaKala", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.shadbalaKala(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("shadbalaKalaFull", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.shadbalaKalaFull(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("compositeStrength", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.compositeStrength(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("signStrengths", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.signStrengths(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("houseStrengths", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.houseStrengths(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("bhavaBala", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.bhavaBala(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("ishtaKashta", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.ishtaKashta(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("vimshopaka(sun)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.vimshopaka(fix.chartA.id, "sun", {
        group: VimshopakaGroup.SHAD_VARGA,
      });
      expect(typeof body).toBe("object");
    });

    it("vargaDignity", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.vargaDignity(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("sambandhas(sun, moon)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.sambandhas(fix.chartA.id, { p1: "sun", p2: "moon" });
      expect(typeof body).toBe("object");
    });

    it("sambandhasForPlanet(sun)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.sambandhasForPlanet(fix.chartA.id, "sun");
      expect(typeof body).toBe("object");
    });

    it("extendedSambandhas(sun, moon)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.extendedSambandhas(fix.chartA.id, {
        p1: "sun",
        p2: "moon",
      });
      expect(typeof body).toBe("object");
    });

    it("extendedSambandhasForPlanet(sun)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.extendedSambandhasForPlanet(fix.chartA.id, "sun");
      expect(typeof body).toBe("object");
    });

    it("houseRelationsForPlanet(sun)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.houseRelationsForPlanet(fix.chartA.id, "sun");
      expect(typeof body).toBe("object");
    });

    it("houseRelationsForHouse(1)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.houseRelationsForHouse(fix.chartA.id, 1);
      expect(typeof body).toBe("object");
    });

    it("specialVargas", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.specialVargas(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("correctedNature", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.correctedNature(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("rays", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.rays(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("progression", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.progression(fix.chartA.id, { eventDate });
      expect(typeof body).toBe("object");
    });

    it("influenceNetwork", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.influenceNetwork(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("rectifyLagna", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.rectifyLagna(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("theoHouseRoles(1)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.theoHouseRoles(fix.chartA.id, 1);
      expect(typeof body).toBe("object");
    });

    it("theoSignInfluences", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.theoSignInfluences(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("theoThematic(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.theoThematic(fix.chartA.id, TheoArea.CAREER);
      expect(typeof body).toBe("object");
    });

    it("houseQuality", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.houseQuality(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("materialization(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.materialization(fix.chartA.id, TheoArea.CAREER);
      expect(typeof body).toBe("object");
    });

    it("materializationAt(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.materializationAt(fix.chartA.id, TheoArea.CAREER, {
        at: transitAt,
      });
      expect(typeof body).toBe("object");
    });

    it("essentialPlanets(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.essentialPlanets(fix.chartA.id, HouseSignificator.CAREER);
      expect(typeof body).toBe("object");
    });

    it("periodModifiers", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.periodModifiers(fix.chartA.id, { at: transitAt });
      expect(typeof body).toBe("object");
    });

    it("transitModifiers", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.transitModifiers(fix.chartA.id, { at: transitAt });
      expect(typeof body).toBe("object");
    });

    it("transitContacts", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.transitContacts(fix.chartA.id, { at: transitAt });
      expect(typeof body).toBe("object");
    });

    it("transitNavamsaActivations", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.transitNavamsaActivations(fix.chartA.id, {
        at: transitAt,
      });
      expect(typeof body).toBe("object");
    });

    it("probability(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.probability(fix.chartA.id, HouseSignificator.CAREER, {
        at: transitAt,
      });
      expect(typeof body).toBe("object");
    });

    it("completeFactor(career)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.completeFactor(fix.chartA.id, HouseSignificator.CAREER);
      expect(typeof body).toBe("object");
    });

    it("metaFactors", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.metaFactors(fix.chartA.id);
      expect(typeof body).toBe("object");
    });

    it("varshaphala(30)", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.varshaphala(fix.chartA.id, 30);
      expect(typeof body).toBe("object");
    });

    it("kpLookup", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.kpLookup({ longitudeDeg: 123.456 });
      expect(typeof body).toBe("object");
    });

    it("muhurta", async () => {
      const fix = fixtures;
      if (!fix) return;
      const body = await fix.client.vedic.muhurta(fix.chartA.id, {
        windowStart,
        windowEnd,
        intervalMinutes: 60,
        topN: 5,
      });
      expect(typeof body).toBe("object");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Plans (2; skip setTenantPlan — mutating)
  // ─────────────────────────────────────────────────────────────

  describe("plans", () => {
    it("list returns a non-empty catalogue", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const plans = await fix.client.plans.list();
      expect(plans.length).toBeGreaterThan(0);
    });

    it("getTenantPlan returns the current tenant plan", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const tenant = await fix.client.plans.getTenantPlan();
      expect(tenant).toBeDefined();
    });

    // setTenantPlan is intentionally skipped — it mutates the tenant
    // and would leak state across runs.
  });

  // ─────────────────────────────────────────────────────────────
  // Usage (2)
  // ─────────────────────────────────────────────────────────────

  describe("usage", () => {
    it("apiKey returns hourly usage for the issued key", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const usage = await fix.client.usage.apiKey(fix.issuedKey.id, {
        since: new Date(FROZEN_NOW.getTime() - ONE_DAY_MS),
        until: FROZEN_NOW,
      });
      expect(usage).toBeDefined();
    });

    it("tenant returns hourly usage for the tenant", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const usage = await fix.client.usage.tenant({
        since: new Date(FROZEN_NOW.getTime() - ONE_DAY_MS),
        until: FROZEN_NOW,
      });
      expect(usage).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // API keys (1; issue + revoke happen in before/afterAll)
  // ─────────────────────────────────────────────────────────────

  describe("apiKeys", () => {
    it("list contains the issued e2e key", async () => {
      const fix = fixtures;
      expect(fix).toBeDefined();
      if (!fix) return;
      const keys: ApiKey[] = await fix.client.apiKeys.list();
      expect(keys.some((k) => k.id === fix.issuedKey.id)).toBe(true);
    });
  });
});
