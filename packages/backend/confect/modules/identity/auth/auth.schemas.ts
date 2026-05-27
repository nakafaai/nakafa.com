import { Schema } from "effect";

const jwksDocumentSchema = Schema.Struct({
  alg: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  expiresAt: Schema.optional(Schema.Union(Schema.Null, Schema.Number)),
  id: Schema.String,
  privateKey: Schema.String,
  publicKey: Schema.String,
});

/**
 * Static JWKS document array returned by the Better Auth Convex plugin.
 *
 * References:
 * - https://labs.convex.dev/better-auth/experimental#static-jwks
 * - https://github.com/get-convex/better-auth/blob/main/src/plugins/convex/index.ts
 */
export const jwksSchema = Schema.Array(jwksDocumentSchema);
