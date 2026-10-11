import "server-only";

import { Duration, Effect, Option, type Schema } from "effect";
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
 * Reads a value that depends only on the active content release.
 *
 * The key holds the release, the kind of read and its parts, so a new release
 * has new keys and an entry is never stale. The first read of a key loads the
 * value and stores it; every later read, in any instance and across deploys,
 * decodes the stored value. A value that does not decode is loaded again.
 *
 * A value is stored only when Convex still names the release of its key after
 * the load. A release is activated once and never again, so a release that is
 * active after the load was active during it. When Convex names another one,
 * the stored pointer was stale: it is dropped and, once, the read starts over
 * under the release that is active now. A caller that already proved a release
 * against Convex passes it as `release`: that read never moves to another
 * release and fails instead, and its key never depends on a pointer that may
 * still name the previous release. With no active release there is nothing to
 * key by, so the value is loaded and not stored.
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
  let releaseId =
    input.release ?? (yield* readActiveContentIdentity())?.releaseId;
  if (releaseId === undefined) {
    return yield* input.load;
  }
  let retries = input.release === undefined ? 1 : 0;
  while (true) {
    const parts = [releaseId, input.kind, ...input.parts];
    const stored = yield* readStoreEntry({ parts, schema: input.schema });
    if (Option.isSome(stored)) {
      return stored.value;
    }
    const value = yield* input.load;
    const active = yield* loadActiveContentIdentity();
    if (active?.releaseId === releaseId) {
      yield* writeStoreEntry({
        name: input.kind,
        parts,
        schema: input.schema,
        tags: [makeReleaseTag(releaseId)],
        ttl: RELEASE_ENTRY_LIFETIME,
        value,
      });
      return value;
    }
    yield* expireActiveContentIdentity().pipe(Effect.ignore({ log: "Warn" }));
    if (active === null || retries === 0) {
      return yield* new PublishedReleaseMismatchError({
        actualReleaseId: active?.releaseId ?? null,
        expectedReleaseId: releaseId,
      });
    }
    releaseId = active.releaseId;
    retries -= 1;
  }
});
