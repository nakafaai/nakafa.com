import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot-data";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Maps malformed program bytes to one public projection failure. */
function projectionError(locale: Locale, publicPath: string) {
  return new PublishedProjectionError({ locale, publicPath });
}

/** Parses one backend-verified snapshot row without thrown JSON failures. */
const decodeSnapshotRow = Effect.fn("NakafaProgram.decodeSnapshotRow")(
  function* (source: string, locale: Locale, publicPath: string) {
    const input = yield* Effect.try({
      catch: () => projectionError(locale, publicPath),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknown(ContentSnapshotRowSchema)(input, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => projectionError(locale, publicPath)));
  }
);

/** Decodes one exact immutable curriculum route row. */
export const decodeCurriculumJson = Effect.fn("NakafaProgram.decodeCurriculum")(
  function* (source: string, locale: Locale, publicPath: string) {
    const decoded = yield* decodeSnapshotRow(source, locale, publicPath);
    if (decoded.family !== "program" || decoded.record.kind !== "curriculum") {
      return yield* projectionError(locale, publicPath);
    }
    return decoded.record.row;
  }
);

/** Decodes one exact immutable learning-program catalog row. */
export const decodeProgramJson = Effect.fn("NakafaProgram.decodeProgram")(
  function* (source: string, locale: Locale, publicPath: string) {
    const decoded = yield* decodeSnapshotRow(source, locale, publicPath);
    if (decoded.family !== "program" || decoded.record.kind !== "program") {
      return yield* projectionError(locale, publicPath);
    }
    return decoded.record.row;
  }
);

export type PublishedCurriculumRoute = CurriculumRoute;
export type PublishedLearningProgram = LearningProgram;
