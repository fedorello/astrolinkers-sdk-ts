/**
 * Zod schemas for the `/v1/api-keys` family of endpoints.
 *
 * The plaintext token is returned exactly once at issue time —
 * subsequent `list` calls only return metadata. Treat
 * {@link IssuedApiKey.token} as the only chance to capture it.
 */

import { z } from "zod";

export const ApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    scopes: z.array(z.string()),
    created_at: z.coerce.date(),
    expires_at: z.coerce.date().nullable().optional(),
    revoked_at: z.coerce.date().nullable().optional(),
    last_used_at: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.string()).default({}),
  })
  .loose();
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const IssuedApiKeySchema = z
  .object({
    api_key: ApiKeySchema,
    token: z.string(),
  })
  .loose();
export type IssuedApiKey = z.infer<typeof IssuedApiKeySchema>;
