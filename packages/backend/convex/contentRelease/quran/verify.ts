import { PublishedQuranRowSchema } from "@repo/backend/content/quran/contract";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { quranRowFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { quranRowDocumentLimit } from "@repo/backend/convex/contentRelease/quran/limits";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Schema } from "effect";
/** Authenticates one immutable Quran row and every indexed fact. */
export const verifyQuranRow = Effect.fn("contentRelease.verifyQuranRow")(
  function* <A, I>(
    row: WithoutSystemFields<Doc<"quranRows">>,
    snapshotId: string,
    payloadSchema: Schema.Codec<A, I, never, never>
  ) {
    const decoded = yield* parseStoredJson(
      row.rowJson,
      "Quran snapshot row"
    ).pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(PublishedQuranRowSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Quran snapshot row does not satisfy its bounded publication contract.",
          })
      )
    );
    if (
      decoded.record.rowHash !== row.rowHash ||
      decoded.record.snapshotId !== snapshotId ||
      row.snapshotId !== snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran row ${row.identity} lost its signed snapshot.`
      );
    }
    const facts = quranRowFacts(decoded.record);
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
      quranRowDocumentLimit(decoded.record.payload.kind)
    );
    if (
      facts.identity !== row.identity ||
      facts.kind !== row.kind ||
      facts.firstVerse !== row.firstVerse ||
      facts.appLocale !== row.appLocale ||
      facts.surahNumber !== row.surahNumber
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran row ${row.identity} changed its indexed facts.`
      );
    }
    return yield* Schema.decodeUnknownEffect(payloadSchema)(
      decoded.record.payload
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Quran row ${row.identity} changed its payload kind.`,
          })
      )
    );
  }
);
