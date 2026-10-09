import type { Ref } from "@confect/core";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/publication";
import type refs from "@repo/backend/confect/_generated/refs";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Data, Effect, Schema } from "effect";

type QuranInterpretationResult = Ref.Returns<
  typeof refs.public.contentRelease.quran.tafsir
>;
/** Typed client failure for one exact tafsir request. */
export class QuranInterpretationRequestError extends Data.TaggedError(
  "QuranInterpretationRequestError"
)<{
  readonly cause: unknown;
}> {}
/** Maps an unknown request rejection into the Quran client error channel. */
export function toQuranInterpretationRequestError(cause: unknown) {
  return new QuranInterpretationRequestError({
    cause,
  });
}
/** Returns whether the active signed Quran snapshot superseded this request. */
export function isQuranSnapshotConflict(error: unknown) {
  if (!(error instanceof QuranInterpretationRequestError)) {
    return false;
  }
  if (!Schema.is(ReleaseError)(error.cause)) {
    return false;
  }
  return error.cause.code === "CONTENT_RELEASE_CONFLICT";
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
    result.tafsirAccess === null ||
    result.tafsirAccess.appLocale !== expected.appLocale ||
    result.tafsirAccess.kind !== "embedded" ||
    source.snapshotId !== expected.snapshotId ||
    result.surahNumber !== expected.surahNumber ||
    result.verseNumber !== expected.verseNumber ||
    !result.interpretation?.trim()
  ) {
    return yield* QuranPublicationError.make({
      operation: "interpretation",
      reason: "Signed Quran interpretation identity is inconsistent.",
    });
  }
  return {
    ...source,
    appLocale: result.appLocale,
    interpretation: result.interpretation,
    surahNumber: result.surahNumber,
    tafsirAccess: result.tafsirAccess,
    verseNumber: result.verseNumber,
  };
});
