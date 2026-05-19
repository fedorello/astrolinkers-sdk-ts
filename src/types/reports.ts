/** Zod schemas for the report-generation pipeline. */

import { z } from "zod";

export const ReportKind = {
  TALENT_LENS: "talent_lens",
  PERSONAL_READER: "personal_reader",
} as const;
export type ReportKind = (typeof ReportKind)[keyof typeof ReportKind];

export const ReportFormat = {
  HTML: "html",
  PDF: "pdf",
} as const;
export type ReportFormat = (typeof ReportFormat)[keyof typeof ReportFormat];

export const ReportStatus = {
  PENDING: "pending",
  RUNNING: "running",
  READY: "ready",
  FAILED: "failed",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ReportSchema = z
  .object({
    id: z.string(),
    chart_id: z.string(),
    kind: z.enum(["talent_lens", "personal_reader"]),
    format: z.enum(["html", "pdf"]),
    status: z.enum(["pending", "running", "ready", "failed"]),
    artifact_url: z.string().nullable().optional(),
    artifact_key: z.string().nullable(),
    error: z.string().nullable().optional(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .loose();
export type Report = z.infer<typeof ReportSchema>;
