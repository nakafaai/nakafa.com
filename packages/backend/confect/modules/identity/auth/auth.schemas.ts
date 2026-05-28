import { Schema } from "effect";

/** Better Auth user fields consumed by app-user synchronization. */
export const authTriggerUserSchema = Schema.Struct({
  authId: Schema.String,
  email: Schema.String,
  image: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  name: Schema.String,
});

/** Better Auth component user document fields consumed by trigger adapters. */
export const betterAuthUserSchema = Schema.Struct({
  _id: Schema.String,
  email: Schema.String,
  image: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  name: Schema.String,
});

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
