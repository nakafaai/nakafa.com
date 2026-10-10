import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { deriveKeys, open, seal } from "@repo/backend/confect/vault/cipher";
import { readRing } from "@repo/backend/confect/vault/ring";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { Clock, Crypto, Effect, HashMap } from "effect";

const LEARNER_KEY_BYTES = 32;

type UserId = Docs["users"]["_id"];
type Ring = Effect.Success<ReturnType<typeof readRing>>;

/** What a wrapped learner key is bound to: it unwraps only for that learner. */
function wrapBinding(userId: UserId) {
  return `nakafa/vault/key/v1|user|${userId}`;
}

/** Finds the stored key row of one learner. */
const findKey = Effect.fn("vault.keys.find")(function* (userId: UserId) {
  return yield* (yield* DatabaseReader)
    .table("vaultKeys")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Unwraps a stored learner key with the root key that wrapped it. */
const unwrap = Effect.fn("vault.keys.unwrap")(
  function* (ring: Ring, row: Docs["vaultKeys"]) {
    const root = yield* Effect.fromOption(HashMap.get(ring.keys, row.root));
    return yield* open(root, wrapBinding(row.userId), row.wrapped);
  },
  Effect.mapError(() => new VaultError({ reason: "key" }))
);

/**
 * Reads a learner's keys to open sealed values. It fails with reason `key`
 * when the learner has no key: nothing was sealed yet, or the key was shredded.
 */
export const readLearnerKeys = Effect.fn("vault.keys.read")(function* (
  userId: UserId
) {
  const row = yield* findKey(userId);
  if (!row) {
    return yield* new VaultError({ reason: "key" });
  }
  const key = yield* unwrap(yield* readRing(), row);
  return { ...(yield* deriveKeys(key)), userId };
});

/**
 * Reads a learner's keys to seal values, and creates the key on first use: 32
 * random bytes, stored only wrapped by the current root key.
 */
export const ensureLearnerKeys = Effect.fn("vault.keys.ensure")(function* (
  userId: UserId
) {
  const ring = yield* readRing();
  const row = yield* findKey(userId);
  if (row) {
    const key = yield* unwrap(ring, row);
    return { ...(yield* deriveKeys(key)), userId };
  }
  const key = yield* (yield* Crypto.Crypto)
    .randomBytes(LEARNER_KEY_BYTES)
    .pipe(Effect.orDie);
  yield* (yield* DatabaseWriter)
    .table("vaultKeys")
    .insert({
      createdAt: yield* Clock.currentTimeMillis,
      root: ring.current.id,
      userId,
      wrapped: yield* seal(ring.current.keys, wrapBinding(userId), key),
    })
    .pipe(Effect.orDie);
  return { ...(yield* deriveKeys(key)), userId };
}, Effect.provide(WebCryptoLayer));

/**
 * Deletes a learner's key. Everything sealed for the learner stays unreadable,
 * in old backups too once the root key that wrapped it is retired.
 */
export const shredLearnerKeys = Effect.fn("vault.keys.shred")(function* (
  userId: UserId
) {
  const row = yield* findKey(userId);
  if (!row) {
    return false;
  }
  yield* (yield* DatabaseWriter)
    .table("vaultKeys")
    .delete(row._id)
    .pipe(Effect.orDie);
  return true;
});

/**
 * Moves one page of learner keys from a retired root key to the current one.
 * Sealed values do not change: only the wrapping of each learner key does.
 * It returns how many keys it moved; zero means the rotation is complete and
 * the retired root keys can leave `VAULT_ROOT_KEYS`.
 */
export const rewrapLearnerKeys = Effect.fn("vault.keys.rewrap")(function* (
  limit: number
) {
  const ring = yield* readRing();
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  for (const retired of ring.retired) {
    const rows = yield* reader
      .table("vaultKeys")
      .index("by_root", (query) => query.eq("root", retired))
      .take(limit)
      .pipe(Effect.orDie);
    for (const row of rows) {
      const key = yield* unwrap(ring, row);
      yield* writer
        .table("vaultKeys")
        .patch(row._id, {
          root: ring.current.id,
          wrapped: yield* seal(ring.current.keys, wrapBinding(row.userId), key),
        })
        .pipe(Effect.orDie);
    }
    if (rows.length > 0) {
      return rows.length;
    }
  }
  return 0;
});
