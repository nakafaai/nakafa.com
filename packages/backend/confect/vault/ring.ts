import { deriveKeys } from "@repo/backend/confect/vault/cipher";
import { RootKeyId, VaultError } from "@repo/backend/confect/vault/schema";
import {
  Array as Arr,
  Config,
  Effect,
  HashMap,
  Redacted,
  Result,
  Schema,
  String as Str,
} from "effect";
import { Base64 } from "effect/encoding";

const ROOT_KEY_BYTES = 32;

const malformed = new VaultError({ reason: "configuration" });

/** Reads one `id:key` entry: a root key name and 32 bytes in Base64. */
const readEntry = Effect.fn("vault.ring.readEntry")(function* (entry: string) {
  const [name, encoded, ...rest] = Str.split(entry, ":");
  const id = yield* Schema.decodeEffect(RootKeyId)(name).pipe(
    Effect.mapError(() => malformed)
  );
  const key = Result.getOrUndefined(Base64.decode(encoded ?? ""));
  if (rest.length > 0 || key?.length !== ROOT_KEY_BYTES) {
    return yield* malformed;
  }
  return { id, keys: yield* deriveKeys(key) };
});

/**
 * Reads the root keys from `VAULT_ROOT_KEYS`: `id:key` entries separated by
 * commas. The first entry wraps new learner keys. The entries after it only
 * unwrap, while a rotation moves every learner key to the first. The value
 * never reaches a log or an error.
 */
export const readRing = Effect.fn("vault.ring.read")(function* () {
  const value = yield* Config.Redacted("VAULT_ROOT_KEYS").pipe(
    Effect.mapError(() => malformed)
  );
  const entries = yield* Effect.forEach(
    Str.split(Redacted.value(value), ","),
    readEntry
  );
  const keys = HashMap.fromIterable(
    Arr.map(entries, (entry) => [entry.id, entry.keys])
  );
  if (HashMap.size(keys) < entries.length) {
    return yield* malformed;
  }
  return {
    current: Arr.headNonEmpty(entries),
    keys,
    retired: Arr.map(Arr.tailNonEmpty(entries), (entry) => entry.id),
  };
});
