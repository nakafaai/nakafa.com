import { PublishedQuranAttributionSchema } from "@repo/backend/content/quran/contract";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect } from "effect";

/** Reads and verifies the unique attribution row for one active snapshot. */
export const readQuranAttributionRow = Effect.fn(
  "contentRelease.readQuranAttributionRow"
)(function* (snapshotId: string) {
  const source = yield* QuranSource;
  const rows = yield* source.metadata(snapshotId, "quran-attribution", 2);
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} lost its unique attribution row.`
    );
  }
  const payload = yield* verifyQuranRow(
    row,
    snapshotId,
    PublishedQuranAttributionSchema
  );
  return { payload, rowJson: row.rowJson };
});

/** Returns the visible signed source attribution for active Quran content. */
export const readQuranAttribution = Effect.fn(
  "contentRelease.readQuranAttribution"
)(function* () {
  const owner = yield* loadQuranOwner();
  if (owner.snapshotId === null) {
    return {
      ...owner,
      rowJson: null,
    };
  }
  const row = yield* readQuranAttributionRow(owner.snapshotId);
  return {
    ...owner,
    rowJson: row.rowJson,
  };
});
