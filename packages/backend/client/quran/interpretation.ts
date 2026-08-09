import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranInterpretationResult = FunctionReturnType<
  typeof api.contentRelease.quran.interpretation
>;

/** Decodes one active exact-verse tafsir response. */
export const decodePublishedQuranInterpretation = Effect.fn(
  "NakafaQuran.decodeInterpretation"
)(function* (
  result: QuranInterpretationResult,
  expected: {
    readonly locale: QuranInterpretationResult["locale"];
    readonly snapshotId: string;
    readonly surahNumber: number;
    readonly verseNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "interpretation");
  if (
    result.locale !== expected.locale ||
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
    interpretation: result.interpretation,
    locale: result.locale,
    surahNumber: result.surahNumber,
    verseNumber: result.verseNumber,
  };
});

export type PublishedQuranInterpretation = Effect.Effect.Success<
  ReturnType<typeof decodePublishedQuranInterpretation>
>;
