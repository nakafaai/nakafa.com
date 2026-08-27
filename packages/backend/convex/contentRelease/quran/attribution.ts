import { QuranAttributionRowSchema } from "@nakafa/aksara-contracts/quran/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { verifyRollbackQuranAttribution } from "@repo/backend/convex/contentRelease/quran/rollback";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect } from "effect";

/** Reads and verifies the unique attribution row for one active snapshot. */
export const readQuranAttributionRow = Effect.fn(
  "contentRelease.readQuranAttributionRow"
)(function* (ctx: QueryCtx, snapshotId: string) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("quranRows")
      .withIndex(
        "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
        (index) =>
          index.eq("snapshotId", snapshotId).eq("kind", "quran-attribution")
      )
      .take(2)
  );
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} lost its unique attribution row.`
    );
  }
  const attribution = yield* verifyQuranRow(
    row,
    snapshotId,
    QuranAttributionRowSchema
  ).pipe(
    Effect.map((payload) => ({ contract: "current" as const, payload })),
    Effect.catchTag("ReleaseError", () =>
      verifyRollbackQuranAttribution(row, snapshotId).pipe(
        Effect.map((payload) => ({ contract: "rollback" as const, payload }))
      )
    )
  );
  return { ...attribution, rowJson: row.rowJson };
});

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
  const row = yield* readQuranAttributionRow(ctx, owner.snapshotId);
  return {
    ...owner,
    rowJson: row.rowJson,
  };
});
