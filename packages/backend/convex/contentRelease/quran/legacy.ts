import { QuranAttributionRowSchema as LegacyQuranAttributionRowSchema } from "@nakafa/aksara-v151/quran/source";
import { ContentSnapshotRowSchema as LegacyContentSnapshotRowSchema } from "@nakafa/aksara-v151/release/snapshot/data";
import { LegacyQuranSurahUpgradeSchema } from "@repo/backend/content/quran/upgrade";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { quranRowDocumentLimit } from "@repo/backend/convex/contentRelease/quran/limits";
import { Effect, Schema } from "effect";

const decodeLegacyQuranRow = Effect.fn("contentRelease.decodeLegacyQuranRow")(
  (source: string) =>
    parseStoredJson(source, "Legacy Quran snapshot row").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(LegacyContentSnapshotRowSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Legacy Quran snapshot row does not satisfy its exact contract.",
          })
      )
    )
);

/** Authenticates the one 0.15.1 attribution shape used during rollout. */
export const verifyLegacyQuranAttribution = Effect.fn(
  "contentRelease.verifyLegacyQuranAttribution"
)(function* (row: Doc<"quranRows">, snapshotId: string) {
  const decoded = yield* decodeLegacyQuranRow(row.rowJson);
  if (
    decoded.family !== "quran" ||
    decoded.record.payload.kind !== "quran-attribution" ||
    decoded.record.rowHash !== row.rowHash ||
    decoded.record.snapshotId !== snapshotId ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran attribution ${row.identity} lost its legacy signed snapshot.`
    );
  }
  const payload = yield* Schema.decodeEffect(LegacyQuranAttributionRowSchema, {
    onExcessProperty: "error",
  })(decoded.record.payload).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Quran attribution ${row.identity} changed its legacy payload.`,
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
      `Quran attribution ${row.identity} changed its legacy indexed facts.`
    );
  }
  return payload;
});

/** Authenticates and upgrades one 0.15.1 surah during the bounded rollout. */
export const verifyLegacyQuranSurah = Effect.fn(
  "contentRelease.verifyLegacyQuranSurah"
)(function* (row: Doc<"quranRows">, snapshotId: string) {
  const decoded = yield* decodeLegacyQuranRow(row.rowJson);
  if (
    decoded.family !== "quran" ||
    decoded.record.payload.kind !== "quran-surah" ||
    decoded.record.rowHash !== row.rowHash ||
    decoded.record.snapshotId !== snapshotId ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran surah ${row.identity} lost its legacy signed snapshot.`
    );
  }
  const payload = yield* Schema.decodeEffect(LegacyQuranSurahUpgradeSchema, {
    onExcessProperty: "error",
  })(decoded.record.payload).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Quran surah ${row.identity} changed its legacy payload.`,
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
      `Quran surah ${row.identity} changed its legacy indexed facts.`
    );
  }
  return payload;
});
