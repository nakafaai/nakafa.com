import "@tanstack/react-start/server-only";

import { Duration, Effect, Option, Result, type Schema } from "effect";
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
 * after it is activated, so this only bounds the memory that the entries of old
 * releases keep before the isolate drops them.
 */
const RELEASE_ENTRY_LIFETIME = Duration.days(30);

/** Store tag shared by every entry of one release. */
function makeReleaseTag(releaseId: ActiveContentReleaseId) {
  return `content-release:${releaseId}`;
}

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
      checked.failure
    );
    return Result.succeed(yield* Effect.fromResult(loaded));
  }
  const active = checked.success;
  if (active?.releaseId === input.releaseId) {
    const value = yield* Effect.fromResult(loaded);
    yield* writeStoreEntry({
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
 * Reads one key under one release: the stored value, or a load that asks Convex
 * for it. It answers the value, or the release that Convex names when it is not
 * the one asked for.
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
  const stored = yield* readStoreEntry({ parts, schema: input.schema });
  if (Option.isSome(stored)) {
    return Result.succeed(stored.value);
  }
  return yield* loadUnderRelease({
    load: input.load,
    parts,
    releaseId,
    schema: input.schema,
  });
});

/**
 * Reads a value that depends only on the active content release.
 *
 * The key holds the release, the kind of read and its parts, so a new release
 * has new keys and an entry is never stale. The first read of a key loads the
 * value and keeps it; every later read in this isolate, until the entry's
 * lifetime ends, decodes the kept value. A value that does not decode is loaded
 * again. The store holds only what Convex answered. Whatever code derives from
 * an answer is derived after this read, so a deploy that changes the derivation
 * takes effect at once.
 *
 * After every load, whether it succeeded or failed, Convex is asked which
 * release is active. A value is kept only when Convex still names the release
 * of its key, because a release is activated once and never again, so a release
 * that is active after the load was active during it. When Convex names another
 * one, the stored pointer was stale: it is dropped and, once, the read starts
 * over under the release that is active now. A caller that already proved a
 * release against Convex passes it as `release`: that read never moves to
 * another release and fails instead, and its key never depends on a pointer
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
 * Two cases cannot be keyed or checked. With no active release there is
 * nothing to key by, so the value is loaded and not kept. When Convex cannot
 * say which release is active after a load, nothing proves the key: the loaded
 * value is returned and not kept.
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
