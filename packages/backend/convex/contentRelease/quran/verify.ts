import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { quranRowFacts } from "@repo/backend/convex/contentRelease/quran/facts";
import { Effect, Schema } from "effect";

/** Authenticates one immutable Quran row and every indexed fact. */
export const verifyQuranRow = Effect.fn("contentRelease.verifyQuranRow")(
  function* <A, I>(
    row: Doc<"quranRows">,
    snapshotId: string,
    payloadSchema: Schema.Schema<A, I, never>
  ) {
    const decoded = yield* decodeSnapshotRowJson(row.rowJson);
    if (
      decoded.family !== "quran" ||
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
    if (
      facts.identity !== row.identity ||
      facts.kind !== row.kind ||
      facts.firstVerse !== row.firstVerse ||
      facts.locale !== row.locale ||
      facts.surahNumber !== row.surahNumber
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran row ${row.identity} changed its indexed facts.`
      );
    }
    return yield* Schema.decodeUnknown(payloadSchema)(
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
