/** Feedback resource — submit verdicts on template statements. */

import type { Transport } from "../transport.js";
import {
  type FeedbackEntry,
  FeedbackEntrySchema,
  type FeedbackRole,
  type FeedbackVerdict,
  type TemplateAccuracy,
  TemplateAccuracySchema,
} from "../types/feedback.js";

export interface SubmitFeedbackParams {
  statementId: string;
  verdict: FeedbackVerdict;
  role?: FeedbackRole;
  userId?: string;
  organizationId?: string;
  comment?: string;
  confidence?: number;
}

export class Feedback {
  constructor(private readonly transport: Transport) {}

  async submit(params: SubmitFeedbackParams): Promise<FeedbackEntry> {
    const body: Record<string, unknown> = {
      statement_id: params.statementId,
      verdict: params.verdict,
      role: params.role ?? "subject",
    };
    if (params.userId !== undefined) body.user_id = params.userId;
    if (params.organizationId !== undefined) body.organization_id = params.organizationId;
    if (params.comment !== undefined) body.comment = params.comment;
    if (params.confidence !== undefined) body.confidence = params.confidence;
    const data = await this.transport.request("POST", "/v1/feedback", { json: body });
    return FeedbackEntrySchema.parse(data);
  }

  async retrieve(feedbackId: string): Promise<FeedbackEntry> {
    const data = await this.transport.request("GET", `/v1/feedback/${feedbackId}`);
    return FeedbackEntrySchema.parse(data);
  }

  async templateAccuracy(templateId: string): Promise<TemplateAccuracy> {
    const data = await this.transport.request("GET", `/v1/feedback/templates/${templateId}`);
    return TemplateAccuracySchema.parse(data);
  }
}
