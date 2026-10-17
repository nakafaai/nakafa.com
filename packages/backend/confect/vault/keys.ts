import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { deriveKeys, open, seal } from "@repo/backend/confect/vault/cipher";
import { readRing } from "@repo/backend/confect/vault/ring";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { encodeJsonText } from "@repo/utilities/json";
import { Clock, Crypto, Effect, HashMap, Option } from "effect";

/** Bytes in every key that a root key wraps: a learner's key and a school's key. */
const KEY_BYTES = 32;
/** The generation of the first key that a school gets. */
const FIRST_GENERATION = 1;

type UserId = Docs["users"]["_id"];
type TenantId = Docs["tenants"]["_id"];
type Ring = Effect.Success<ReturnType<typeof readRing>>;

/** What a wrapped learner key is bound to: it unwraps only for that learner. */
export function wrapBinding(userId: UserId) {
  return encodeJsonText(["nakafa/vault/key/v1", userId]);
}

/**
 * What a wrapped school key is bound to: one school and one generation. Its
 * label differs from a learner's, so a key of either kind never unwraps as the
 * other.
 */
export function tenantWrapBinding(tenantId: TenantId, generation: number) {
  return encodeJsonText(["nakafa/vault/school-key/v1", tenantId, generation]);
}

/**
 * Unwraps a stored key with the root key that its row names, for the binding it
 * was wrapped under. Any failure, including an unknown root key, is reason `key`.
 */
export const unwrap = Effect.fn("vault.keys.unwrap")(
  function* (ring: Ring, root: string, wrapped: ArrayBuffer, binding: string) {
    const rootKey = yield* Effect.fromOption(HashMap.get(ring.keys, root));
    return yield* open(rootKey, binding, wrapped);
  },
  Effect.mapError(() => new VaultError({ reason: "key" }))
);

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

/** Finds the newest key row of one school, the generation that seals its text. */
const findTenantKey = Effect.fn("vault.keys.findTenant")(function* (
  tenantId: TenantId
) {
  return yield* (yield* DatabaseReader)
    .table("tenantKeys")
    .index(
      "by_tenantId_and_generation",
      (query) => query.eq("tenantId", tenantId),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * Reads a learner's keys to open sealed values. It fails with reason `key` when
 * the learner has no key: nothing was sealed yet, or the key was shredded.
 */
export const readLearnerKeys = Effect.fn("vault.keys.read")(function* (
  userId: UserId
) {
  const row = yield* findKey(userId);
  if (!row) {
    return yield* new VaultError({ reason: "key" });
  }
  const key = yield* unwrap(
    yield* readRing(),
    row.root,
    row.wrapped,
    wrapBinding(userId)
  );
  return { ...(yield* deriveKeys(key)), userId };
});

/**
 * Reads a school's keys to open and seal its text, from its newest generation.
 * It fails with reason `key` when the school has no key. Provisioning writes the
 * first key together with the school, so a school without one is a defect in
 * its data (ADR 0030).
 */
/** The keys of one learner, as `readLearnerKeys` and `ensureLearnerKeys` return them. */
export type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

export const readTenantKeys = Effect.fn("vault.keys.readTenant")(function* (
  tenantId: TenantId
) {
  const row = yield* findTenantKey(tenantId);
  if (Option.isNone(row)) {
    return yield* new VaultError({ reason: "key" });
  }
  const { generation, root, wrapped } = row.value;
  const key = yield* unwrap(
    yield* readRing(),
    root,
    wrapped,
    tenantWrapBinding(tenantId, generation)
  );
  return { ...(yield* deriveKeys(key)), generation, tenantId };
});

/**
 * Reads a learner's keys to seal values, and creates the key on first use: 32
 * random bytes, stored only wrapped by the current root key. A deleted account
 * gets no key.
 */
export const ensureLearnerKeys = Effect.fn("vault.keys.ensure")(function* (
  userId: UserId
) {
  const ring = yield* readRing();
  const row = yield* findKey(userId);
  if (row) {
    const key = yield* unwrap(ring, row.root, row.wrapped, wrapBinding(userId));
    return { ...(yield* deriveKeys(key)), userId };
  }
  // A write that outlives its account must not give a deleted learner a new
  // key: nothing would ever shred it again.
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!user || user.deletedAt !== undefined) {
    return yield* new VaultError({ reason: "key" });
  }
  const key = yield* (yield* Crypto.Crypto)
    .randomBytes(KEY_BYTES)
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
 * Creates generation 1 of a school's key: 32 random bytes, stored only wrapped
 * by the current root key. Provisioning calls it in the transaction that inserts
 * the school, so no school exists without a key.
 */
export const createTenantKey = Effect.fn("vault.keys.createTenant")(function* (
  tenantId: TenantId
) {
  const ring = yield* readRing();
  const key = yield* (yield* Crypto.Crypto)
    .randomBytes(KEY_BYTES)
    .pipe(Effect.orDie);
  yield* (yield* DatabaseWriter)
    .table("tenantKeys")
    .insert({
      createdAt: yield* Clock.currentTimeMillis,
      generation: FIRST_GENERATION,
      root: ring.current.id,
      tenantId,
      wrapped: yield* seal(
        ring.current.keys,
        tenantWrapBinding(tenantId, FIRST_GENERATION),
        key
      ),
    })
    .pipe(Effect.orDie);
}, Effect.provide(WebCryptoLayer));

/**
 * Deletes a learner's key. Everything sealed for the learner stays unreadable,
 * in old backups too once every copy of the root key that wrapped it is
 * destroyed.
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
