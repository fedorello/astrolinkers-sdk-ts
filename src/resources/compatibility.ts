/** Compatibility resource — synastry + ashtakoota between two charts. */

import type { Transport } from "../transport.js";
import {
  type CompatibilityAxis,
  type CompatibilityReport,
  CompatibilityReportSchema,
} from "../types/compatibility.js";

export interface CreateCompatibilityParams {
  chartAId: string;
  chartBId: string;
  axis?: CompatibilityAxis;
  includeAshtakoota?: boolean;
  includeSynastry?: boolean;
}

export class Compatibility {
  constructor(private readonly transport: Transport) {}

  async create(params: CreateCompatibilityParams): Promise<CompatibilityReport> {
    const data = await this.transport.request("POST", "/v1/compatibility", {
      json: {
        chart_a_id: params.chartAId,
        chart_b_id: params.chartBId,
        axis: params.axis ?? "talent",
        include_ashtakoota: params.includeAshtakoota ?? true,
        include_synastry: params.includeSynastry ?? true,
      },
    });
    return CompatibilityReportSchema.parse(data);
  }

  async retrieve(reportId: string): Promise<CompatibilityReport> {
    const data = await this.transport.request("GET", `/v1/compatibility/${reportId}`);
    return CompatibilityReportSchema.parse(data);
  }
}
