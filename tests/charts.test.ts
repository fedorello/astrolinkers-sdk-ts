/** Charts resource — create + retrieve. */

import { beforeEach, describe, expect, it } from "vitest";

import { FakeFetch, newClient, jsonResponse } from "./setup.js";

const CHART_PAYLOAD = {
  id: "019e3cdd-14d9-7960-924f-26578bb111f5",
  system: "vedic",
  ayanamsha: "lahiri",
  house_system: "placidus",
  computed_at: "2026-05-18T22:00:00Z",
  birth: {
    moment: "1990-04-15T02:00:00Z",
    latitude: 28.6139,
    longitude: 77.209,
  },
  planets: [
    {
      planet: "sun",
      longitude: 24.5,
      sign: "aries",
      degree_in_sign: 24.5,
      speed_per_day: 0.985,
      is_retrograde: false,
      nakshatra: "Bharani",
      pada: 3,
      navamsa_sign: "leo",
      navamsa_lord: "sun",
    },
  ],
  houses: [{ house: 1, longitude: 5.0 }],
};

let fake: FakeFetch;

beforeEach(() => {
  fake = new FakeFetch();
});

describe("charts.create", () => {
  it("sends the birth block + parses the response", async () => {
    fake.on("POST", "/v1/charts", () => jsonResponse(CHART_PAYLOAD, { status: 201 }));
    const client = newClient(fake);
    const chart = await client.charts.create({
      moment: new Date("1990-04-15T02:00:00Z"),
      latitude: 28.6139,
      longitude: 77.209,
    });
    expect(chart.id).toBe(CHART_PAYLOAD.id);
    const body = fake.calls.at(-1)?.body ?? "";
    expect(body).toContain("1990-04-15");
    expect(body).toContain("lahiri");
    expect(body).toContain("vedic");
    expect(body).toContain("placidus");
  });
});

describe("charts.retrieve", () => {
  it("uses the right URL", async () => {
    fake.on("GET", "/v1/charts/abc", () => jsonResponse(CHART_PAYLOAD));
    const client = newClient(fake);
    const chart = await client.charts.retrieve("abc");
    expect(chart.id).toBe(CHART_PAYLOAD.id);
    expect(chart.houses[0]?.house).toBe(1);
    expect(chart.planets[0]?.sign).toBe("aries");
  });
});
