/** Reports resource — async PDF / HTML report pipeline. */

import type { Transport } from "../transport.js";
import { type Report, type ReportFormat, type ReportKind, ReportSchema } from "../types/reports.js";

export interface CreateReportParams {
  chartId: string;
  kind?: ReportKind;
  format?: ReportFormat;
  locale?: string;
  tone?: string;
}

export class Reports {
  constructor(private readonly transport: Transport) {}

  async create(params: CreateReportParams): Promise<Report> {
    const data = await this.transport.request("POST", "/v1/reports", {
      json: {
        chart_id: params.chartId,
        kind: params.kind ?? "talent_lens",
        format: params.format ?? "html",
        locale: params.locale ?? "en",
        tone: params.tone ?? "corporate",
      },
    });
    return ReportSchema.parse(data);
  }

  async retrieve(reportId: string): Promise<Report> {
    const data = await this.transport.request("GET", `/v1/reports/${reportId}`);
    return ReportSchema.parse(data);
  }
}
