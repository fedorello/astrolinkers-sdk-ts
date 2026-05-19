/**
 * Zod schemas for the `/v1/api-keys` family of endpoints.
 *
 * The plaintext token is returned exactly once at issue time —
 * subsequent `list` calls only return metadata. Treat
 * {@link IssuedApiKey.plaintext} as the only chance to capture it.
 */

import { z } from "zod";

export const ApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    key_prefix: z.string(),
    key_last4: z.string(),
    display: z.string(),
    scopes: z.array(z.string()),
    owner_tenant_id: z.string(),
    created_at: z.coerce.date(),
    created_by: z.string(),
    last_used_at: z.coerce.date().nullable(),
    expires_at: z.coerce.date().nullable(),
    revoked_at: z.coerce.date().nullable(),
    metadata: z.record(z.string(), z.string()).default({}),
  })
  .loose();
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const IssuedApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    key_prefix: z.string(),
    key_last4: z.string(),
    display: z.string(),
    scopes: z.array(z.string()),
    owner_tenant_id: z.string(),
    created_at: z.coerce.date(),
    created_by: z.string(),
    last_used_at: z.coerce.date().nullable(),
    expires_at: z.coerce.date().nullable(),
    revoked_at: z.coerce.date().nullable(),
    metadata: z.record(z.string(), z.string()).default({}),
    plaintext: z.string(),
  })
  .loose();
export type IssuedApiKey = z.infer<typeof IssuedApiKeySchema>;
