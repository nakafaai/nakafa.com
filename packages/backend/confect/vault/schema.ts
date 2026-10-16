import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The name of one root key in `VAULT_ROOT_KEYS`. */
export const RootKeyId = Schema.String.check(
  Schema.isPattern(/^[a-z0-9]{1,16}$/u)
);

/** A sealed value as stored: format, nonce, ciphertext and tag in one value. */
export const Sealed = Schema.instanceOf(ArrayBuffer);

/**
 * One learner's key, wrapped by the root key that `root` names. Once this row
 * is deleted and every copy of that root key is destroyed, nothing sealed for
 * the learner can be read, old backups included.
 */
export const VaultKey = Schema.Struct({
  createdAt: Schema.Finite,
  root: RootKeyId,
  userId: Id("users"),
  wrapped: Sealed,
});

/**
 * One key of a school, wrapped by the root key that `root` names. A school has
 * one row for each generation, counted from 1. The newest generation seals new
 * text (ADR 0030).
 */
export const TenantKey = Schema.Struct({
  createdAt: Schema.Finite,
  generation: Schema.Int.check(Schema.isGreaterThan(0)),
  root: RootKeyId,
  tenantId: Id("tenants"),
  wrapped: Sealed,
});

/**
 * The stored field a sealed value belongs to. A value opens only for the owner
 * and the field it was sealed for. When the field belongs to one row, `row` holds
 * the values that name that row, in a fixed order (ADR 0024), so a value copied
 * to another row never opens.
 */
export const VaultField = Schema.Struct({
  field: Schema.String,
  row: Schema.optionalKey(
    Schema.Array(Schema.Union([Schema.String, Schema.Finite]))
  ),
  table: Schema.String,
});

/**
 * Why the vault could not seal or open. `configuration`: `VAULT_ROOT_KEYS` is
 * missing or malformed. `key`: the learner or the school has no key, the account
 * is deleted, or no root key in the environment opens the stored key. `cipher`:
 * the value does not open for this owner, table, field and row, or it was
 * changed. It also covers sealed content that authenticates but does not decode
 * as the value its module expects. `runtime`: the platform could not derive a key
 * or seal, which says nothing about stored data. No reason carries key material
 * or text.
 */
export class VaultError extends Schema.TaggedError<VaultError>()("VaultError", {
  reason: Schema.Literals(["configuration", "key", "cipher", "runtime"]),
}) {}
