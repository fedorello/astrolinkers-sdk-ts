/**
 * Zod schemas + inferred types for charts.
 *
 * The schemas use `.loose()` so server-side additions to a
 * response do not break older SDK clients — unknown fields are
 * preserved on the parsed object.
 */

import { z } from "zod";

const ZAstrologySystem = z.enum(["western", "vedic"]);
const ZAyanamshaType = z.union([z.enum(["lahiri", "raman", "krishnamurti"]), z.string()]);
const ZHouseSystem = z.union([z.enum(["placidus", "whole_sign", "equal", "koch"]), z.string()]);

export const BirthDataSchema = z
  .object({
    moment: z.coerce.date(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().nullable().optional(),
    location_name: z.string().nullable().optional(),
  })
  .loose();
export type BirthData = z.infer<typeof BirthDataSchema>;

export const PlanetPositionSchema = z
  .object({
    planet: z.string(),
    longitude: z.number(),
    speed_per_day: z.number().nullable().optional(),
    is_retrograde: z.boolean().nullable().optional(),
    nakshatra: z.string().nullable().optional(),
    pada: z.number().int().nullable().optional(),
    global_pada: z.number().int().nullable().optional(),
    nakshatra_lord: z.string().nullable().optional(),
  })
  .loose();
export type PlanetPosition = z.infer<typeof PlanetPositionSchema>;

export const HouseCuspSchema = z.object({
  house_number: z.number().int().min(1).max(12),
  longitude: z.number(),
});
export type HouseCusp = z.infer<typeof HouseCuspSchema>;

export const ChartSchema = z
  .object({
    id: z.string(),
    system: ZAstrologySystem,
    ayanamsha: ZAyanamshaType.nullable().optional(),
    house_system: ZHouseSystem,
    computed_at: z.coerce.date(),
    birth: BirthDataSchema,
    planets: z.array(PlanetPositionSchema),
    houses: z.array(HouseCuspSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .loose();
export type Chart = z.infer<typeof ChartSchema>;
