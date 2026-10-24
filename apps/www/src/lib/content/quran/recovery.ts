import "@tanstack/react-start/server-only";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import { expireActiveContentIdentity } from "@/lib/content/published/active";
import { readPublishedQuranIdentity } from "@/lib/content/quran/publication";

/** One stale Quran snapshot could not be safely recovered. */
export class QuranSnapshotRecoveryError extends Schema.TaggedError<QuranSnapshotRecoveryError>()(
  "QuranSnapshotRecoveryError",
  {
    cause: Schema.Unknown,
    reason: Schema.Literals(["active-identity", "invalid-input"]),
  }
) {}

/**
 * Answers a stale Quran snapshot that a reader captured. The snapshot is not
 * stored under a tag of its own: every stored entry is keyed by the content
 * release, and the release pointer decides which release this isolate reads.
 * So a stale snapshot is recovered by dropping this isolate's stored pointer,
 * and the next read asks Convex which release is active. Entries of the stale
 * release stay, because no read of the active release reaches them. The active
 * snapshot is never recovered: the route that asked for it reads it again.
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
  yield* expireActiveContentIdentity();
  return true;
});
