import { Id } from "@repo/backend/confect/_generated/id";
import { Action } from "@repo/backend/confect/access/catalog";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { UnitName } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The name of one integration client, as its school's Admin reads it. A client
 * name follows the one-line rule of a unit's name, which `tenancy/schema` owns,
 * and keeps the 80 characters a unit name held before school names widened it.
 */
export const IntegrationName = UnitName.check(Schema.isMaxLength(80));

/** An active client holds its secret hash; a revoked one holds no secret. */
export const IntegrationStatus = Schema.Literals(["active", "revoked"]);

/** The lower-case hexadecimal SHA-256 digest of a client secret. */
const SecretHash = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));

/**
 * The actions one client may hold: a non-empty list of distinct actions. The
 * catalog decides which actions a client may name, so the list holds an
 * action's name only, never a rule.
 */
export const ClientActions = Schema.NonEmptyArray(Action).check(
  Schema.isUnique()
);

/**
 * Whether a client holds the state its status names. An active client holds its
 * secret hash and no revocation time. A revoked client holds its revocation time
 * and no secret, so a revoked client keeps no way to authenticate.
 */
const holdsItsState = (client: {
  readonly revokedAt: number | null;
  readonly secretHash: string | null;
  readonly status: typeof IntegrationStatus.Type;
}) =>
  client.status === "active"
    ? client.secretHash !== null && client.revokedAt === null
    : client.secretHash === null && client.revokedAt !== null;

/**
 * An integration client as the registry stores it. `scope` covers the tenant
 * or one unit. `secretHash` is set only while the client is active, and
 * `revokedAt` only once it is revoked, as `holdsItsState` checks.
 */
export const integrationClientValidator = Schema.Struct({
  actions: ClientActions,
  name: IntegrationName,
  revokedAt: Schema.NullOr(Schema.Finite),
  rotatedAt: Schema.Finite,
  scope: GrantScope,
  secretHash: Schema.NullOr(SecretHash),
  status: IntegrationStatus,
  tenantId: Id("tenants"),
}).check(
  Schema.makeFilter(holdsItsState, {
    message:
      "An active client holds a secret and no revocation time; a revoked client holds a revocation time and no secret.",
  })
);

/** The resource an access token is bound to (RFC 8707): the school REST API or the school MCP server. */
export const TokenResource = Schema.Literals(["api", "mcp"]);

/**
 * One access token of an integration client. Only the SHA-256 digest of the token is kept,
 * so a reader of the table cannot present it, and the token works only for its resource and
 * until `expiresAt`. Revoking or rotating the client deletes its tokens (ADR 0029).
 */
export const integrationTokenValidator = Schema.Struct({
  clientId: Id("integrationClients"),
  expiresAt: Schema.Finite,
  resource: TokenResource,
  tenantId: Id("tenants"),
  tokenHash: SecretHash,
});

/** Why the token endpoint refused a request, as the OAuth error code it answers. */
const TokenRefusal = Schema.Literals(["invalid_client", "invalid_target"]);

/** What the internal issue answers: the token once, or the refusal. */
export const TokenIssue = Schema.Union([
  Schema.Struct({
    expiresIn: Schema.Finite,
    outcome: Schema.Literal("issued"),
    token: Schema.String,
  }),
  Schema.Struct({ error: TokenRefusal, outcome: Schema.Literal("refused") }),
]);

/** What the internal check of a bearer token answers. */
export const TokenCheck = Schema.Union([
  Schema.Struct({
    clientId: Id("integrationClients"),
    outcome: Schema.Literal("allowed"),
  }),
  Schema.Struct({ outcome: Schema.Literal("unauthorized") }),
  Schema.Struct({
    outcome: Schema.Literal("limited"),
    retryAfter: Schema.Finite,
  }),
]);
