import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Data, Effect, Schema } from "effect";

type QuranInterpretationResult = FunctionReturnType<
  typeof api.contentRelease.quran.interpretation
>;

const QuranSnapshotConflictDataSchema = Schema.Struct({
  code: Schema.Literal("CONTENT_RELEASE_CONFLICT"),
});

/** Typed client failure for one exact tafsir request. */
export class QuranInterpretationRequestError extends Data.TaggedError(
  "QuranInterpretationRequestError"
)<{
  readonly cause: unknown;
}> {}

/** Maps an unknown Convex rejection into the Quran client error channel. */
export function toQuranInterpretationRequestError(cause: unknown) {
  return new QuranInterpretationRequestError({ cause });
}

/** Returns whether the active signed Quran snapshot superseded this request. */
export function isQuranSnapshotConflict(error: unknown) {
  if (!(error instanceof QuranInterpretationRequestError)) {
    return false;
  }

  if (!(error.cause instanceof ConvexError)) {
    return false;
  }

  return Schema.is(QuranSnapshotConflictDataSchema)(error.cause.data);
}

/** Decodes one active exact-verse tafsir response. */
export const decodePublishedQuranInterpretation = Effect.fn(
  "NakafaQuran.decodeInterpretation"
)(function* (
  result: QuranInterpretationResult,
  expected: {
    readonly appLocale: QuranInterpretationResult["appLocale"];
    readonly snapshotId: string;
    readonly surahNumber: number;
    readonly verseNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "interpretation");
  if (
    result.appLocale !== expected.appLocale ||
    source.snapshotId !== expected.snapshotId ||
    result.surahNumber !== expected.surahNumber ||
    result.verseNumber !== expected.verseNumber ||
    !result.interpretation?.trim()
  ) {
    return yield* new QuranPublicationError({
      operation: "interpretation",
      reason: "Signed Quran interpretation identity is inconsistent.",
    });
  }

  return {
    ...source,
    appLocale: result.appLocale,
    interpretation: result.interpretation,
    surahNumber: result.surahNumber,
    verseNumber: result.verseNumber,
  };
});

export type PublishedQuranInterpretation = Effect.Effect.Success<
  ReturnType<typeof decodePublishedQuranInterpretation>
>;
