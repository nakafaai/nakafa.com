import "@tanstack/react-start/server-only";

import { Cause, Duration, Effect, Option, Result, type Schema } from "effect";
import {
  type ActiveContentIdentity,
  type ActiveContentReleaseId,
  type ContentSnapshotFamily,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { readStoreEntry, writeStoreEntry } from "@/lib/content/store/entry";

/**
 * How long an entry of one release or snapshot stays in the store. Neither ever
 * changes after it is activated, so this only bounds the memory that old entries
 * keep before the isolate drops them.
 */
const RELEASE_ENTRY_LIFETIME = Duration.days(30);

/**
 * What a read's answer depends on: the whole active release, or the snapshot of
 * one structured family, which a release keeps until it changes that family.
 */
type ContentScope = "release" | ContentSnapshotFamily;

/**
 * The key of one read's scope: the scope, the id that keys its entries (the
 * release, or the family's snapshot), and the release it was read under, which a
 * mismatch names.
 */
type ScopeKey = Readonly<{
  id: string;
  releaseId: ActiveContentReleaseId;
  scope: ContentScope;
}>;

/** The key of a scope under one active identity, or none for a family that has no snapshot. */
function scopeKeyOf(
  identity: NonNullable<ActiveContentIdentity>,
  scope: ContentScope
): Option.Option<ScopeKey> {
  const id =
    scope === "release" ? identity.releaseId : identity.snapshots[scope];
  return id === null
    ? Option.none()
    : Option.some({ id, releaseId: identity.releaseId, scope });
}

/**
 * The parts that lead every key of a scope. A release keys its entries by its
 * id alone, as it always did, and a snapshot by its family and its id.
 */
function scopeParts(key: ScopeKey) {
  return key.scope === "release" ? [key.id] : [`snapshot:${key.scope}`, key.id];
}

/**
 * One pass of a miss under one scope key: loads the value, then asks Convex
 * which release is active. It answers the value, stored when the scope still has
 * the id of the key under that release, or the identity that is active now when
 * it does not, which also drops the stored pointer. A load that failed keeps its
 * own error, but its check still runs, so a read that Convex refused because a
 * release landed repairs the pointer too.
 */
const loadUnderScope = Effect.fn("www.content.store.load")(function* <
  A,
  I,
  E,
  R,
>(input: {
  readonly key: ScopeKey;
  readonly load: Effect.Effect<A, E, R>;
  readonly parts: readonly string[];
  readonly schema: Schema.Codec<A, I, never, never>;
}) {
  const loaded = yield* Effect.result(input.load);
  const checked = yield* Effect.result(loadActiveContentIdentity());
  if (Result.isFailure(checked)) {
    yield* Effect.logWarning(
      "The content store could not check the active release.",
      Cause.fail(checked.failure)
    );
    return Result.succeed(yield* Effect.fromResult(loaded));
  }
  const active = checked.success;
  const current = Option.flatMap(Option.fromNullOr(active), (identity) =>
    scopeKeyOf(identity, input.key.scope)
  );
  if (Option.exists(current, (key) => key.id === input.key.id)) {
    const value = yield* Effect.fromResult(loaded);
    yield* writeStoreEntry({
      lasting: true,
      parts: input.parts,
      schema: input.schema,
      tags: [`content-${input.key.scope}:${input.key.id}`],
      ttl: RELEASE_ENTRY_LIFETIME,
      value,
    });
    return Result.succeed(value);
  }
  yield* expireActiveContentIdentity();
  if (Result.isFailure(loaded)) {
    return yield* Effect.fail(loaded.failure);
  }
  return Result.fail(active);
});

/**
 * Reads one key under one scope key: the stored value, or a load that asks
 * Convex for it. It answers the value, or the identity that Convex names when
 * the scope no longer has the id of the key.
 */
const readUnderScope = Effect.fn("www.content.store.readUnder")(function* <
  A,
  I,
  E,
  R,
>(
  input: {
    readonly kind: string;
    readonly load: Effect.Effect<A, E, R>;
    readonly parts: readonly string[];
    readonly schema: Schema.Codec<A, I, never, never>;
  },
  key: ScopeKey
) {
  const parts = [...scopeParts(key), input.kind, ...input.parts];
  const stored = yield* readStoreEntry({
    lasting: true,
    parts,
    schema: input.schema,
  });
  if (Option.isSome(stored)) {
    return Result.succeed(stored.value);
  }
  return yield* loadUnderScope({
    key,
    load: input.load,
    parts,
    schema: input.schema,
  });
});

/**
 * Reads a value that depends only on the active content release, or, with
 * `scope`, only on the snapshot that one structured family resolves to under it.
 *
 * The key holds the release (or the family's snapshot), the kind of read and its
 * parts, so a new release, or a new snapshot, has new keys and an entry is never
 * stale. A release that does not change a family keeps its snapshot, so the
 * family's entries answer every later release until it changes. The first read
 * of a key loads the value and keeps it; every later read in this isolate, until
 * the entry's lifetime ends, decodes the kept value. A value that does not decode
 * is loaded again. The store holds only what Convex answered. Whatever code
 * derives from an answer is derived after this read, so a deploy that changes the
 * derivation takes effect at once.
 *
 * After every load, whether it succeeded or failed, Convex is asked which
 * release is active. A value is kept only when the scope still has the id of its
 * key, because a release is activated once and never again, so a release, and
 * the snapshots it names, that are active after the load were active during it.
 * When it does not, the stored pointer was stale: it is dropped and, once, the
 * read starts over under the release that is active now. A caller that already
 * proved a release against Convex passes it as `release`: that read never moves
 * to another release and fails instead, and its key never depends on a pointer
 * that may still name the previous release.
 *
 * A load that fails keeps its own error. Only its check matters: when Convex
 * names another release, the pointer is dropped too, so the next read, and the
 * caller's own retry, start from the release that is active now instead of
 * failing again until the pointer expires.
 *
 * Each request loads its own misses. No load is shared between requests, so a
 * request never waits on I/O that another request started.
 *
 * Three cases cannot be keyed or checked. With no active release, or a family
 * with no snapshot, there is nothing to key by, so the value is loaded and not
 * kept. When Convex cannot say which release is active after a load, nothing
 * proves the key: the loaded value is returned and not kept.
 */
export const readContentStore = Effect.fn("www.content.store.read")(function* <
  A,
  I,
  E,
  R,
>(input: {
  readonly kind: string;
  readonly load: Effect.Effect<A, E, R>;
  readonly parts: readonly string[];
  readonly release?: ActiveContentReleaseId;
  readonly schema: Schema.Codec<A, I, never, never>;
  readonly scope?: ContentSnapshotFamily;
}) {
  if (input.release !== undefined) {
    const pin = input.release;
    const pinned = yield* readUnderScope(input, {
      id: pin,
      releaseId: pin,
      scope: "release",
    });
    if (Result.isSuccess(pinned)) {
      return pinned.success;
    }
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: pinned.failure?.releaseId ?? null,
      expectedReleaseId: pin,
    });
  }
  const scope = input.scope ?? "release";
  const identity = yield* readActiveContentIdentity();
  const key = Option.flatMap(Option.fromNullOr(identity), (active) =>
    scopeKeyOf(active, scope)
  );
  if (Option.isNone(key)) {
    return yield* input.load;
  }
  const first = yield* readUnderScope(input, key.value);
  if (Result.isSuccess(first)) {
    return first.success;
  }
  const moved = first.failure;
  if (moved === null) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: null,
      expectedReleaseId: key.value.releaseId,
    });
  }
  const next = scopeKeyOf(moved, scope);
  if (Option.isNone(next)) {
    return yield* input.load;
  }
  const second = yield* readUnderScope(input, next.value);
  if (Result.isSuccess(second)) {
    return second.success;
  }
  return yield* new PublishedReleaseMismatchError({
    actualReleaseId: second.failure?.releaseId ?? null,
    expectedReleaseId: moved.releaseId,
  });
});
