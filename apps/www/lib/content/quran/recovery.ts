import "server-only";
import { makeArtifactCacheTag } from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import { refresh, updateTag } from "next/cache";
import { readPublishedQuranIdentity } from "@/lib/content/quran/publication";
/** One stale Quran snapshot could not be safely recovered. */
export class QuranSnapshotRecoveryError extends Schema.TaggedError<QuranSnapshotRecoveryError>()(
  "QuranSnapshotRecoveryError",
  {
    cause: Schema.Unknown,
    reason: Schema.Literals([
      "active-identity",
      "cache-invalidation",
      "invalid-input",
      "route-refresh",
    ]),
  }
) {}
/** Refreshes the current route without expiring any server cache entry. */
const refreshQuranRoute = Effect.fn("www.quran.refreshStaleRoute")(
  function* () {
    yield* Effect.try({
      catch: (cause) =>
        new QuranSnapshotRecoveryError({ cause, reason: "route-refresh" }),
      try: refresh,
    });
    return false;
  }
);
/**
 * Expires one server-captured stale Quran snapshot without touching other content.
 */
export const recoverStalePublishedQuranSnapshot = Effect.fn(
  "www.quran.recoverStaleSnapshot"
)(function* (input: unknown) {
  const staleSnapshotId = yield* Schema.decodeUnknownEffect(Sha256HashSchema)(
    input
  ).pipe(
    Effect.mapError(
      (cause) =>
        new QuranSnapshotRecoveryError({ cause, reason: "invalid-input" })
    )
  );
  const activeIdentity = yield* readPublishedQuranIdentity().pipe(
    Effect.mapError(
      (cause) =>
        new QuranSnapshotRecoveryError({ cause, reason: "active-identity" })
    )
  );
  if (activeIdentity.snapshotId === staleSnapshotId) {
    return yield* refreshQuranRoute();
  }
  yield* Effect.try({
    catch: (cause) =>
      new QuranSnapshotRecoveryError({ cause, reason: "cache-invalidation" }),
    try: () => updateTag(makeArtifactCacheTag(staleSnapshotId)),
  });
  return true;
});
