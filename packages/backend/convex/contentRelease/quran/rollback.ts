import { QuranAttributionRowSchema as RollbackQuranAttributionRowSchema } from "@nakafa/aksara-rollback/quran/source";
import { ContentSnapshotRowSchema as RollbackContentSnapshotRowSchema } from "@nakafa/aksara-rollback/release/snapshot/data";
import { RollbackQuranSurahSchema } from "@repo/backend/content/quran/rollback";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { quranRowDocumentLimit } from "@repo/backend/convex/contentRelease/quran/limits";
import { Effect, Schema } from "effect";

const decodeRollbackQuranRow = Effect.fn(
  "contentRelease.decodeRollbackQuranRow"
)((source: string) =>
  parseStoredJson(source, "Retained Quran rollback row").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(RollbackContentSnapshotRowSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message:
            "Retained Quran rollback row does not satisfy its signed contract.",
        })
    )
  )
);

/** Authenticates the retained attribution until rollback uses the current shape. */
export const verifyRollbackQuranAttribution = Effect.fn(
  "contentRelease.verifyRollbackQuranAttribution"
)(function* (row: Doc<"quranRows">, snapshotId: string) {
  const decoded = yield* decodeRollbackQuranRow(row.rowJson);
  if (
    decoded.family !== "quran" ||
    decoded.record.payload.kind !== "quran-attribution" ||
    decoded.record.rowHash !== row.rowHash ||
    decoded.record.snapshotId !== snapshotId ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran attribution ${row.identity} lost its retained signed snapshot.`
    );
  }
  const payload = yield* Schema.decodeEffect(
    RollbackQuranAttributionRowSchema,
    { onExcessProperty: "error" }
  )(decoded.record.payload).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Quran attribution ${row.identity} changed its retained payload.`,
        })
    )
  );
  yield* ensureDocumentSize(
    `Quran row ${row.identity}`,
    {
      appLocale: row.appLocale,
      firstVerse: row.firstVerse,
      identity: row.identity,
      index: row.index,
      kind: row.kind,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
      snapshotId: row.snapshotId,
      surahNumber: row.surahNumber,
    },
    quranRowDocumentLimit(payload.kind)
  );
  const identity = `attribution:${payload.sources
    .map(({ id }) => id)
    .join(":")}`;
  if (
    row.identity !== identity ||
    row.kind !== payload.kind ||
    row.appLocale !== undefined ||
    row.firstVerse !== undefined ||
    row.surahNumber !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran attribution ${row.identity} changed its retained indexed facts.`
    );
  }
  return payload;
});

/** Authenticates and upgrades one surah from the retained rollback snapshot. */
export const verifyRollbackQuranSurah = Effect.fn(
  "contentRelease.verifyRollbackQuranSurah"
)(function* (row: Doc<"quranRows">, snapshotId: string) {
  const decoded = yield* decodeRollbackQuranRow(row.rowJson);
  if (
    decoded.family !== "quran" ||
    decoded.record.payload.kind !== "quran-surah" ||
    decoded.record.rowHash !== row.rowHash ||
    decoded.record.snapshotId !== snapshotId ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran surah ${row.identity} lost its retained signed snapshot.`
    );
  }
  const payload = yield* Schema.decodeEffect(RollbackQuranSurahSchema, {
    onExcessProperty: "error",
  })(decoded.record.payload).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Quran surah ${row.identity} changed its retained payload.`,
        })
    )
  );
  yield* ensureDocumentSize(
    `Quran row ${row.identity}`,
    {
      appLocale: row.appLocale,
      firstVerse: row.firstVerse,
      identity: row.identity,
      index: row.index,
      kind: row.kind,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
      snapshotId: row.snapshotId,
      surahNumber: row.surahNumber,
    },
    quranRowDocumentLimit(payload.kind)
  );
  if (
    row.identity !== `surah:${payload.number}` ||
    row.kind !== payload.kind ||
    row.appLocale !== undefined ||
    row.firstVerse !== undefined ||
    row.surahNumber !== payload.number
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran surah ${row.identity} changed its retained indexed facts.`
    );
  }
  return payload;
});
