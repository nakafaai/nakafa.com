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
 * The stored field a sealed value belongs to. A value opens only for the
 * learner and the field it was sealed for.
 */
export const VaultField = Schema.Struct({
  field: Schema.String,
  table: Schema.String,
});

/**
 * Why the vault could not seal or open. `configuration`: `VAULT_ROOT_KEYS` is
 * missing or malformed. `key`: the learner has no key, the account is deleted,
 * or no root key in the environment opens the learner's key. `cipher`: the
 * value was not sealed for this learner and field, or it was changed.
 * `runtime`: the platform could not derive a key or seal, which says nothing
 * about stored data. No reason carries key material or text.
 */
export class VaultError extends Schema.TaggedError<VaultError>()("VaultError", {
  reason: Schema.Literals(["configuration", "key", "cipher", "runtime"]),
}) {}
