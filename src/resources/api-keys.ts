/** API keys resource — issue / list / revoke the caller's own keys. */

import type { Transport } from "../transport.js";
import {
  type ApiKey,
  ApiKeySchema,
  type IssuedApiKey,
  IssuedApiKeySchema,
} from "../types/api-keys.js";

export interface IssueApiKeyParams {
  name: string;
  scopes: string[];
  expiresAt?: Date;
  metadata?: Record<string, string>;
}

export class ApiKeys {
  constructor(private readonly transport: Transport) {}

  async issue(params: IssueApiKeyParams): Promise<IssuedApiKey> {
    const body: Record<string, unknown> = {
      name: params.name,
      scopes: params.scopes,
    };
    if (params.expiresAt !== undefined) body.expires_at = params.expiresAt.toISOString();
    if (params.metadata !== undefined) body.metadata = params.metadata;
    const data = await this.transport.request("POST", "/v1/api-keys", { json: body });
    return IssuedApiKeySchema.parse(data);
  }

  async list(options: { includeRevoked?: boolean } = {}): Promise<ApiKey[]> {
    const data = await this.transport.request("GET", "/v1/api-keys", {
      params: { include_revoked: options.includeRevoked ?? false },
    });
    const items = data && typeof data === "object" && "keys" in data ? data.keys : undefined;
    return ApiKeySchema.array().parse(items);
  }

  async revoke(keyId: string): Promise<ApiKey> {
    const data = await this.transport.request("POST", `/v1/api-keys/${keyId}/revoke`);
    return ApiKeySchema.parse(data);
  }
}
