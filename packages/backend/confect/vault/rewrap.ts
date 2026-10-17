import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { seal } from "@repo/backend/confect/vault/cipher";
import {
  tenantWrapBinding,
  unwrap,
  wrapBinding,
} from "@repo/backend/confect/vault/keys";
import { readRing } from "@repo/backend/confect/vault/ring";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { Effect, Option } from "effect";

type Ring = Effect.Success<ReturnType<typeof readRing>>;

/**
 * Wraps one stored key again under the current root key. The sealed bytes change,
 * the key does not.
 */
const rewrapping = Effect.fn("vault.rewrap.key")(function* (
  ring: Ring,
  root: string,
  wrapped: ArrayBuffer,
  binding: string
) {
  const key = yield* unwrap(ring, root, wrapped, binding);
  return {
    root: ring.current.id,
    wrapped: yield* seal(ring.current.keys, binding, key),
  };
});

/**
 * Moves one page of learner keys from the first retired root key that still
 * holds some. It returns how many it moved, or zero when no learner key names a
 * retired root key.
 */
const rewrapLearnerPage = Effect.fn("vault.rewrap.learnerPage")(function* (
  ring: Ring,
  limit: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  for (const retired of ring.retired) {
    const rows = yield* reader
      .table("vaultKeys")
      .index("by_root", (query) => query.eq("root", retired))
      .take(limit)
      .pipe(Effect.orDie);
    for (const row of rows) {
      yield* writer
        .table("vaultKeys")
        .patch(
          row._id,
          yield* rewrapping(
            ring,
            row.root,
            row.wrapped,
            wrapBinding(row.userId)
          )
        )
        .pipe(Effect.orDie);
    }
    if (rows.length > 0) {
      return rows.length;
    }
  }
  return 0;
});

/**
 * Moves one page of school keys from the first retired root key that still holds
 * some. It returns how many it moved, or zero when no school key names a retired
 * root key.
 */
const rewrapSchoolPage = Effect.fn("vault.rewrap.schoolPage")(function* (
  ring: Ring,
  limit: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  for (const retired of ring.retired) {
    const rows = yield* reader
      .table("tenantKeys")
      .index("by_root", (query) => query.eq("root", retired))
      .take(limit)
      .pipe(Effect.orDie);
    for (const row of rows) {
      yield* writer
        .table("tenantKeys")
        .patch(
          row._id,
          yield* rewrapping(
            ring,
            row.root,
            row.wrapped,
            tenantWrapBinding(row.tenantId, row.generation)
          )
        )
        .pipe(Effect.orDie);
    }
    if (rows.length > 0) {
      return rows.length;
    }
  }
  return 0;
});

/**
 * Fails while a stored key names a root key that the environment does not hold.
 * Such a key cannot be moved, so reporting zero would hide it.
 */
const refuseUnknownRoots = Effect.fn("vault.rewrap.unknownRoots")(function* (
  ring: Ring
) {
  const reader = yield* DatabaseReader;
  const current = ring.current.id;
  const [learnersBelow, learnersAbove, schoolsBelow, schoolsAbove] =
    yield* Effect.all([
      reader
        .table("vaultKeys")
        .index("by_root", (query) => query.lt("root", current))
        .first(),
      reader
        .table("vaultKeys")
        .index("by_root", (query) => query.gt("root", current))
        .first(),
      reader
        .table("tenantKeys")
        .index("by_root", (query) => query.lt("root", current))
        .first(),
      reader
        .table("tenantKeys")
        .index("by_root", (query) => query.gt("root", current))
        .first(),
    ]).pipe(Effect.orDie);
  if (
    Option.isSome(learnersBelow) ||
    Option.isSome(learnersAbove) ||
    Option.isSome(schoolsBelow) ||
    Option.isSome(schoolsAbove)
  ) {
    return yield* new VaultError({ reason: "configuration" });
  }
});

/**
 * Moves one page of keys from a retired root key to the current one: learner keys
 * first, then school keys. Sealed values do not change, only the wrapping of each
 * key does. It returns how many keys it moved. Zero means that every learner key
 * and every school key is wrapped by the current root key, so the retired root
 * keys can leave `VAULT_ROOT_KEYS` and be destroyed. It fails with reason
 * `configuration`, instead of returning zero, while a stored key names a root key
 * that is not in the environment.
 */
export const rewrapKeys = Effect.fn("vault.rewrap.keys")(function* (
  limit: number
) {
  const ring = yield* readRing();
  const learners = yield* rewrapLearnerPage(ring, limit);
  if (learners > 0) {
    return learners;
  }
  const schools = yield* rewrapSchoolPage(ring, limit);
  if (schools > 0) {
    return schools;
  }
  yield* refuseUnknownRoots(ring);
  return 0;
});
