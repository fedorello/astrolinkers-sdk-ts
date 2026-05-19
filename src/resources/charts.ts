/** Charts resource — `POST /v1/charts` and `GET /v1/charts/{id}`. */

import type { Transport } from "../transport.js";
import { ChartSchema, type Chart } from "../types/charts.js";
import type { AstrologySystem, HouseSystem } from "../types/enums.js";

export interface CreateChartParams {
  moment: Date;
  latitude: number;
  longitude: number;
  system?: AstrologySystem;
  houseSystem?: HouseSystem;
  ayanamsha?: string | null;
}

function buildBody(params: CreateChartParams): Record<string, unknown> {
  const birth: Record<string, unknown> = {
    moment: params.moment.toISOString(),
    latitude: params.latitude,
    longitude: params.longitude,
  };

  const body: Record<string, unknown> = {
    birth,
    system: params.system ?? "vedic",
    house_system: params.houseSystem ?? "placidus",
  };
  const ayanamsha = params.ayanamsha === undefined ? "lahiri" : params.ayanamsha;
  if (ayanamsha !== null) body.ayanamsha = ayanamsha;
  return body;
}

export class Charts {
  constructor(private readonly transport: Transport) {}

  /** Compute and persist a new natal chart. */
  async create(params: CreateChartParams): Promise<Chart> {
    const data = await this.transport.request("POST", "/v1/charts", {
      json: buildBody(params),
    });
    return ChartSchema.parse(data);
  }

  /** Fetch a previously-created chart by id. */
  async retrieve(chartId: string): Promise<Chart> {
    const data = await this.transport.request("GET", `/v1/charts/${chartId}`);
    return ChartSchema.parse(data);
  }
}
