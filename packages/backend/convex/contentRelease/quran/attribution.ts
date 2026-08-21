import { QuranAttributionRowSchema } from "@nakafa/aksara-contracts/quran/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect } from "effect";

/** Returns the visible signed source attribution for active Quran content. */
export const readQuranAttribution = Effect.fn(
  "contentRelease.readQuranAttribution"
)(function* (ctx: QueryCtx) {
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return {
      ...owner,
      rowJson: null,
    };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("quranRows")
      .withIndex(
        "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
        (index) =>
          index
            .eq("snapshotId", owner.snapshotId)
            .eq("kind", "quran-attribution")
      )
      .take(2)
  );
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${owner.snapshotId} lost its unique attribution row.`
    );
  }
  yield* verifyQuranRow(row, owner.snapshotId, QuranAttributionRowSchema);
  return {
    ...owner,
    rowJson: row.rowJson,
  };
});
