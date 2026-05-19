/**
 * Vedic engine — all 58 `/v1/vedic/...` endpoints.
 *
 * Every method returns a `Record<string, unknown>` because Vedic
 * responses are deeply nested, structured JSON (divisional charts,
 * dasha chains, sambandha graphs, ashtakavarga matrices) and
 * modelling each one would be more maintenance burden than DX
 * benefit — consumers iterate / index these structures rather than
 * match against a typed model.
 *
 * Method signatures **are** typed, so call sites get IDE autocomplete
 * for path / query parameters and TypeScript catches typos. The
 * runtime guard {@link ensureDict} converts any contract violation
 * (e.g. a server change that returns a list) into a loud TypeError
 * at the call site.
 *
 * Vedic enums (`Varga`, `TheoArea`, `HouseSignificator`, `BhavaStyle`,
 * `VimshopakaGroup`) are exported from `astrolinkers/types/vedic-enums`.
 */

import type { QueryValue, Transport } from "../transport.js";
import type { BhavaStyle, TheoArea, Varga, VimshopakaGroup } from "../types/vedic-enums.js";

type VedicResponse = Record<string, unknown>;

function ensureDict(value: unknown): VedicResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Expected JSON object from Vedic endpoint, got ${typeof value}`);
  }
  return value as VedicResponse;
}

function isoParam(at: Date): Record<string, QueryValue> {
  return { at: at.toISOString() };
}

export class Vedic {
  constructor(private readonly transport: Transport) {}

  private async getDict(path: string, params?: Record<string, QueryValue>): Promise<VedicResponse> {
    const options = params ? { params } : {};
    const data = await this.transport.request("GET", path, options);
    return ensureDict(data);
  }

  // ── Divisional + bhava ───────────────────────────────────────

  divisional(chartId: string, varga: Varga): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/divisional/${varga}`);
  }

  bhavaChakra(chartId: string, options: { style?: BhavaStyle } = {}): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/bhava-chakra`, {
      style: options.style ?? "raman",
    });
  }

  specialLagnas(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/special-lagnas`);
  }

  aspects(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/aspects`);
  }

  aspectsWithOrb(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/aspects/with-orb`);
  }

  dignity(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/dignity`);
  }

  functionalNature(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/functional-nature`);
  }

  // ── Dasha + period lords ─────────────────────────────────────

  vimshottari(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/dasha/vimshottari`);
  }

  currentDasha(chartId: string, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/dasha/current`, isoParam(params.at));
  }

  yoginiDasha(chartId: string, options: { totalYears?: number } = {}): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/dasha/yogini`, {
      total_years: options.totalYears ?? 72,
    });
  }

  charaDasha(chartId: string, options: { totalYears?: number } = {}): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/dasha/chara`, {
      total_years: options.totalYears ?? 78,
    });
  }

  periodLords(chartId: string, params: { sunrise: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/period-lords`, {
      sunrise: params.sunrise.toISOString(),
    });
  }

  // ── Yogas, karakas, arudhas, badhaka ─────────────────────────

  yogas(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/yogas`);
  }

  jaiminiKarakas(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/karakas/jaimini`);
  }

  arudha(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/arudha`);
  }

  badhaka(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/badhaka`);
  }

  // ── Ashtakavarga ─────────────────────────────────────────────

  ashtakavarga(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/ashtakavarga`);
  }

  ashtakavargaCorrected(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/ashtakavarga/corrected`);
  }

  // ── Panchanga / location-bound ───────────────────────────────

  panchanga(params: { at: Date; lat: number; lon: number }): Promise<VedicResponse> {
    return this.getDict("/v1/vedic/panchanga", {
      at: params.at.toISOString(),
      lat: params.lat,
      lon: params.lon,
    });
  }

  // ── Shadbala + strengths ─────────────────────────────────────

  shadbala(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/shadbala`);
  }

  shadbalaKala(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/shadbala/kala`);
  }

  shadbalaKalaFull(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/shadbala/kala-full`);
  }

  compositeStrength(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/strength/composite`);
  }

  signStrengths(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/strength/signs`);
  }

  houseStrengths(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/strength/houses`);
  }

  bhavaBala(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/bhava-bala`);
  }

  ishtaKashta(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/ishta-kashta`);
  }

  vimshopaka(
    chartId: string,
    planet: string,
    options: { group?: VimshopakaGroup } = {},
  ): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/vimshopaka/${planet}`, {
      group: options.group ?? "shad_varga",
    });
  }

  vargaDignity(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/varga-dignity`);
  }

  // ── Sambandhas ───────────────────────────────────────────────

  sambandhas(chartId: string, params: { p1: string; p2: string }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/sambandhas`, {
      p1: params.p1,
      p2: params.p2,
    });
  }

  sambandhasForPlanet(chartId: string, planet: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/sambandhas/${planet}`);
  }

  extendedSambandhas(chartId: string, params: { p1: string; p2: string }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/extended-sambandhas`, {
      p1: params.p1,
      p2: params.p2,
    });
  }

  extendedSambandhasForPlanet(chartId: string, planet: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/extended-sambandhas/${planet}`);
  }

  // ── House relations + special vargas ─────────────────────────

  houseRelationsForPlanet(chartId: string, planet: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/house-relations/planet/${planet}`);
  }

  houseRelationsForHouse(chartId: string, houseNumber: number): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/house-relations/house/${String(houseNumber)}`);
  }

  specialVargas(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/special-vargas`);
  }

  correctedNature(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/corrected-nature`);
  }

  // ── Rays + rectification + Theo ──────────────────────────────

  rays(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/rays`);
  }

  progression(chartId: string, params: { eventDate: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/progression`, {
      event_date: params.eventDate.toISOString(),
    });
  }

  influenceNetwork(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/influence-network`);
  }

  rectifyLagna(chartId: string, options: { stepMinutes?: number } = {}): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/rectify-lagna`, {
      step_minutes: options.stepMinutes ?? 10,
    });
  }

  theoHouseRoles(chartId: string, houseNumber: number): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/theo/house-roles/${String(houseNumber)}`);
  }

  theoSignInfluences(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/theo/sign-influences`);
  }

  theoThematic(chartId: string, area: TheoArea): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/theo/thematic/${area}`);
  }

  houseQuality(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/house-quality`);
  }

  // ── Predictive ───────────────────────────────────────────────

  materialization(chartId: string, area: TheoArea): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/predict/materialization/${area}`);
  }

  materializationAt(chartId: string, area: TheoArea, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(
      `/v1/vedic/charts/${chartId}/predict/materialization/${area}/at`,
      isoParam(params.at),
    );
  }

  essentialPlanets(chartId: string, theme: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/essential-planets/${theme}`);
  }

  periodModifiers(chartId: string, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/period-modifiers`, isoParam(params.at));
  }

  transitModifiers(chartId: string, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/transit-modifiers`, isoParam(params.at));
  }

  transitContacts(chartId: string, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/transits/contacts`, isoParam(params.at));
  }

  transitNavamsaActivations(chartId: string, params: { at: Date }): Promise<VedicResponse> {
    return this.getDict(
      `/v1/vedic/charts/${chartId}/transits/navamsa-activations`,
      isoParam(params.at),
    );
  }

  probability(chartId: string, theme: string, options: { at?: Date } = {}): Promise<VedicResponse> {
    const params = options.at ? { at: options.at.toISOString() } : undefined;
    return this.getDict(`/v1/vedic/charts/${chartId}/probability/${theme}`, params);
  }

  completeFactor(chartId: string, theme: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/complete-factor/${theme}`);
  }

  metaFactors(chartId: string): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/meta-factors`);
  }

  // ── KP, varshaphala, muhurta ─────────────────────────────────

  varshaphala(chartId: string, ageYears: number): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/varshaphala/${String(ageYears)}`);
  }

  kpLookup(params: { longitudeDeg: number }): Promise<VedicResponse> {
    return this.getDict("/v1/vedic/kp/lookup", {
      longitude_deg: params.longitudeDeg,
    });
  }

  muhurta(
    chartId: string,
    params: {
      windowStart: Date;
      windowEnd: Date;
      intervalMinutes?: number;
      topN?: number;
    },
  ): Promise<VedicResponse> {
    return this.getDict(`/v1/vedic/charts/${chartId}/muhurta`, {
      window_start: params.windowStart.toISOString(),
      window_end: params.windowEnd.toISOString(),
      interval_minutes: params.intervalMinutes ?? 60,
      top_n: params.topN ?? 10,
    });
  }
}
