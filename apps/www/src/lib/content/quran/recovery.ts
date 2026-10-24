import "@tanstack/react-start/server-only";
import { makeArtifactCacheTag } from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import { readPublishedQuranIdentity } from "@/lib/content/quran/publication";
import { expireStoreTag } from "@/lib/content/store/entry";

/** One stale Quran snapshot could not be safely recovered. */
export class QuranSnapshotRecoveryError extends Schema.TaggedError<QuranSnapshotRecoveryError>()(
  "QuranSnapshotRecoveryError",
  {
    cause: Schema.Unknown,
    reason: Schema.Literals(["active-identity", "invalid-input"]),
  }
) {}

/**
 * Expires one server-captured stale Quran snapshot without touching other content.
 * The active snapshot is never expired: the route that asked for it reads it again.
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
    return false;
  }
  yield* expireStoreTag(makeArtifactCacheTag(staleSnapshotId));
  return true;
});
