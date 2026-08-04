import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect, type Schema } from "effect";

/** Reads and authenticates one exact row from an active Quran snapshot. */
export const readQuranRow = Effect.fn("contentRelease.readQuranRow")(function* <
  A,
  I,
>(
  ctx: QueryCtx,
  snapshotId: string,
  identity: string,
  payloadSchema: Schema.Schema<A, I, never>
) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("quranRows")
      .withIndex("by_snapshotId_and_identity", (index) =>
        index.eq("snapshotId", snapshotId).eq("identity", identity)
      )
      .unique()
  );
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
