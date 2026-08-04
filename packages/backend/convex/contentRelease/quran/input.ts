import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { QURAN_REFERENCE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { Effect } from "effect";

interface QuranReferenceInput {
  readonly fromVerse: number;
  readonly surahNumber: number;
  readonly toVerse?: number;
}

/** Validates one canonical Quran surah number at the runtime boundary. */
export const validateQuranSurah = Effect.fn(
  "contentRelease.validateQuranSurah"
)(function* (surahNumber: number) {
  if (
    !Number.isSafeInteger(surahNumber) ||
    surahNumber < 1 ||
    surahNumber > QURAN_SURAH_COUNT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INVALID_REQUEST",
      `Quran surah must be an integer from 1 to ${QURAN_SURAH_COUNT}.`
    );
  }
  return surahNumber;
});

/** Validates and normalizes one bounded Quran verse reference. */
export const validateQuranReference = Effect.fn(
  "contentRelease.validateQuranReference"
)(function* (input: QuranReferenceInput) {
  const surahNumber = yield* validateQuranSurah(input.surahNumber);
  const toVerse = input.toVerse ?? input.fromVerse;
  if (
    !(Number.isSafeInteger(input.fromVerse) && Number.isSafeInteger(toVerse)) ||
    input.fromVerse < 1 ||
    toVerse < input.fromVerse
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INVALID_REQUEST",
      "Quran references require one ascending positive integer range."
    );
  }
  if (toVerse - input.fromVerse + 1 > QURAN_REFERENCE_VERSE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Quran references accept at most ${QURAN_REFERENCE_VERSE_LIMIT} verses.`
    );
  }
  return { fromVerse: input.fromVerse, surahNumber, toVerse };
});
