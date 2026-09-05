import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect, Option, type Schema } from "effect";
/** Reads and authenticates one exact row from an active Quran snapshot. */
export const readQuranRow = Effect.fn("contentRelease.readQuranRow")(function* <
  A,
  I,
>(
  snapshotId: string,
  identity: string,
  payloadSchema: Schema.Codec<A, I, never, never>
) {
  const source = yield* QuranSource;
  const selected = yield* source.row(snapshotId, identity);
  const stored = Option.getOrNull(selected);
  if (stored === null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran row ${identity} is unavailable.`
    );
  }
  const payload = yield* verifyQuranRow(stored, snapshotId, payloadSchema);
  return {
    index: stored.index,
    payload,
    rowHash: stored.rowHash,
    rowJson: stored.rowJson,
  };
});
