import { Id } from "@repo/backend/confect/_generated/id";
import { Action } from "@repo/backend/confect/access/catalog";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The name of one integration client, as its school's Admin reads it. */
export const IntegrationName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

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
 * An integration client as the registry stores it. `scope` covers the tenant
 * or one unit; `secretHash` and `revokedAt` are null when they do not apply.
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
});
