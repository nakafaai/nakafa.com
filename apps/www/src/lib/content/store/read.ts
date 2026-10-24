import "@tanstack/react-start/server-only";

import { encodeJsonText } from "@repo/utilities/json";
import {
  Cause,
  Deferred,
  Duration,
  Effect,
  MutableHashMap,
  Option,
  Result,
  type Schema,
} from "effect";
import {
  type ActiveContentReleaseId,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { readStoreEntry, writeStoreEntry } from "@/lib/content/store/entry";

/**
 * How long an entry of one release stays in the store. A release never changes
 * after it is activated, so this only bounds the storage that the entries of
 * old releases keep before the Runtime Cache evicts them.
 */
const RELEASE_ENTRY_LIFETIME = Duration.days(30);

/** Store tag shared by every entry of one release. */
function makeReleaseTag(releaseId: ActiveContentReleaseId) {
  return `content-release:${releaseId}`;
}

/**
 * The keys that a miss is loading right now in this instance, each with the
 * signal that ends together with its load. Misses of one key that overlap
 * share the first load, so a burst of requests for one lesson at a release
 * change asks Convex once and not once per request.
 */
const loading = MutableHashMap.empty<string, Deferred.Deferred<void>>();

/**
 * Claims the load of one key for the caller, or answers the signal of the load
 * that already runs. The lookup and the claim happen in one synchronous step,
 * so two callers can never both claim one key.
 */
const claimLoad = Effect.fn("www.content.store.claim")(function* (key: string) {
  const own = yield* Deferred.make<void>();
  return yield* Effect.sync(() => {
    const running = MutableHashMap.get(loading, key);
    if (Option.isSome(running)) {
      return Result.fail(running.value);
    }
    MutableHashMap.set(loading, key, own);
    return Result.succeed(own);
  });
});

/** Ends the load of one key, so the callers that wait for it go on. */
const endLoad = (key: string, own: Deferred.Deferred<void>) =>
  Effect.sync(() => MutableHashMap.remove(loading, key)).pipe(
    Effect.andThen(Deferred.succeed(own, undefined))
  );

/**
 * Runs `load` as the only load of one key. A caller that finds the key loading
 * waits for that load to end, whatever its outcome, and then asks `recheck` for
 * what it left in the store. A caller that claims the key asks too, because a
 * load may have ended and stored its value between the caller's first read and
 * its claim. With nothing in the store, because the load failed or could not
 * prove its key, the caller loads on its own, so one failure never queues the
 * callers behind it.
 */
const loadOnce = Effect.fn("www.content.store.once")(function* <
  A,
  E,
  R,
>(input: {
  readonly key: string;
  readonly load: Effect.Effect<
    Result.Result<A, ActiveContentReleaseId | null>,
    E,
    R
  >;
  readonly recheck: Effect.Effect<Option.Option<A>>;
}) {
  const settle = Effect.gen(function* () {
    const stored = yield* input.recheck;
    if (Option.isSome(stored)) {
      return Result.succeed(stored.value);
    }
    return yield* input.load;
  });
  const claim = yield* claimLoad(input.key);
  if (Result.isFailure(claim)) {
    yield* Deferred.await(claim.failure);
    return yield* settle;
  }
  return yield* settle.pipe(Effect.ensuring(endLoad(input.key, claim.success)));
});

/**
 * One pass of a miss under one release: loads the value, then asks Convex which
 * release is active. It answers the value, stored when Convex still names the
 * release of the key, or the release that is active now when Convex names
 * another one, which also drops the stored pointer. A load that failed keeps
 * its own error, but its check still runs, so a read that Convex refused
 * because a release landed repairs the pointer too.
 */
const loadUnderRelease = Effect.fn("www.content.store.load")(function* <
  A,
  I,
  E,
  R,
>(input: {
  readonly kind: string;
  readonly load: Effect.Effect<A, E, R>;
  readonly parts: readonly string[];
  readonly releaseId: ActiveContentReleaseId;
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
  if (active?.releaseId === input.releaseId) {
    const value = yield* Effect.fromResult(loaded);
    yield* writeStoreEntry({
      name: input.kind,
      parts: input.parts,
      schema: input.schema,
      tags: [makeReleaseTag(input.releaseId)],
      ttl: RELEASE_ENTRY_LIFETIME,
      value,
    });
    return Result.succeed(value);
  }
  yield* expireActiveContentIdentity().pipe(Effect.ignore({ log: "Warn" }));
  if (Result.isFailure(loaded)) {
    return yield* Effect.fail(loaded.failure);
  }
  return Result.fail(active?.releaseId ?? null);
});

/**
 * Reads one key under one release: the stored value, or the one load that every
 * miss of the key shares. It answers the value, or the release that Convex names
 * when it is not the one asked for.
 */
const readUnderRelease = Effect.fn("www.content.store.readUnder")(function* <
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
  releaseId: ActiveContentReleaseId
) {
  const parts = [releaseId, input.kind, ...input.parts];
  const read = readStoreEntry({ parts, schema: input.schema });
  const stored = yield* read;
  if (Option.isSome(stored)) {
    return Result.succeed(stored.value);
  }
  return yield* loadOnce({
    key: encodeJsonText(parts),
    load: loadUnderRelease({
      kind: input.kind,
      load: input.load,
      parts,
      releaseId,
      schema: input.schema,
    }),
    recheck: read,
  });
});

/**
 * Reads a value that depends only on the active content release.
 *
 * The key holds the release, the kind of read and its parts, so a new release
 * has new keys and an entry is never stale. The first read of a key loads the
 * value and stores it; every later read, in any instance and across deploys,
 * decodes the stored value. A value that does not decode is loaded again. The
 * store holds only what Convex answered. Whatever code derives from an answer
 * is derived after this read, so a deploy that changes the derivation takes
 * effect at once.
 *
 * After every load, whether it succeeded or failed, Convex is asked which
 * release is active. A value is stored only when Convex still names the release
 * of its key, because a release is activated once and never again, so a release
 * that is active after the load was active during it. When Convex names another
 * one, the stored pointer was stale: it is dropped and, once, the read starts
 * over under the release that is active now. A caller that already proved a
 * release against Convex passes it as `release`: that read never moves to
 * another release and fails instead, and its key never depends on a pointer
 * that may still name the previous release.
 *
 * The check is one more Convex read per miss, the pointer, which is a fraction
 * of the size of the loads it follows, and no read of a stored key pays it. It
 * is kept for every read instead of trusting a release named inside the loaded
 * value, because only some answers name their release, and one rule for all of
 * them is the only one that cannot differ between reads.
 *
 * A load that fails keeps its own error. Only its check matters: when Convex
 * names another release, the pointer is dropped too, so the next read, and the
 * caller's own retry, start from the release that is active now instead of
 * failing again until the pointer expires.
 *
 * Misses of one key that overlap share one load. The others wait for it and
 * read what it stored.
 *
 * Two cases cannot be keyed or checked. With no active release there is
 * nothing to key by, so the value is loaded and not stored. When Convex cannot
 * say which release is active after a load, nothing proves the key: the loaded
 * value is returned and not stored.
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
}) {
  const releaseId =
    input.release ?? (yield* readActiveContentIdentity())?.releaseId;
  if (releaseId === undefined) {
    return yield* input.load;
  }
  const first = yield* readUnderRelease(input, releaseId);
  if (Result.isSuccess(first)) {
    return first.success;
  }
  const moved = first.failure;
  if (moved === null || input.release !== undefined) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: moved,
      expectedReleaseId: releaseId,
    });
  }
  const second = yield* readUnderRelease(input, moved);
  if (Result.isSuccess(second)) {
    return second.success;
  }
  return yield* new PublishedReleaseMismatchError({
    actualReleaseId: second.failure,
    expectedReleaseId: moved,
  });
});
