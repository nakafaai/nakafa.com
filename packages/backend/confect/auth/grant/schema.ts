import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * An agent that registered itself (RFC 7591): its own name and the addresses an
 * authorization may return to. It has no secret: every authorization proves the
 * client with PKCE (ADR 0029). Its id is its `client_id`.
 */
export const agentClientValidator = Schema.Struct({
  name: Schema.String,
  redirectUris: Schema.NonEmptyArray(Schema.String),
});

/**
 * One authorization code that a person gave an agent on the consent page. The
 * raw code reaches the agent once, in the redirect, and only its hash is kept;
 * the agent trades it once, with the verifier of `codeChallenge` (S256).
 */
export const agentCodeValidator = Schema.Struct({
  clientId: Id("agentClients"),
  userId: Id("users"),
  codeHash: Schema.String,
  codeChallenge: Schema.String,
  redirectUri: Schema.String,
  expiresAt: Schema.Finite,
});

/**
 * An agent a person let in. The agent's access tokens name this row, so
 * deleting it ends them at once; its refresh token is kept as a hash and
 * replaced at every refresh, and a grant unused for its lifetime ends.
 */
export const agentGrantValidator = Schema.Struct({
  clientId: Id("agentClients"),
  userId: Id("users"),
  refreshHash: Schema.String,
  refreshedAt: Schema.Finite,
});

/**
 * The OAuth error codes that the agent endpoints answer (RFC 6749 section 5.2,
 * RFC 7591 section 3.2.2). `slow_down` is a registration over the limit.
 */
const AgentRefusalCode = Schema.Literals([
  "invalid_client",
  "invalid_client_metadata",
  "invalid_grant",
  "invalid_redirect_uri",
  "invalid_request",
  "slow_down",
]);

/** A refused agent request, with the OAuth error code that the endpoint answers. */
export class AgentRefused extends Schema.TaggedError<
  AgentRefused,
  { readonly brand: unique symbol }
>()("AgentRefused", {
  error: AgentRefusalCode,
  error_description: Schema.String,
}) {}

/** The token answer of RFC 6749 section 5.1. */
const AgentTokens = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Finite,
  refresh_token: Schema.String,
  scope: Schema.String,
  token_type: Schema.Literal("Bearer"),
});

/** An agent a person let in, as the settings page lists it. */
export const AgentListing = Schema.Struct({
  grantId: Id("agentGrants"),
  name: Schema.String,
  refreshedAt: Schema.Finite,
});

/** The answer of a token request: the tokens, or the refusal that the endpoint answers with HTTP 400. */
export const AgentExchange = Schema.Union([
  Schema.Struct({ outcome: Schema.Literal("issued"), tokens: AgentTokens }),
  Schema.Struct({
    outcome: Schema.Literal("refused"),
    error: Schema.Literal("invalid_grant"),
    error_description: Schema.String,
  }),
]);
