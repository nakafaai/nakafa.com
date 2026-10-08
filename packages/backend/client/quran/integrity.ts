import { Schema } from "effect";

const NumberedSurahSchema = Schema.Struct({
  number: Schema.Finite,
});
type NumberedSurah = typeof NumberedSurahSchema.Type;

const NumberedVerseSchema = Schema.Struct({
  number: Schema.Struct({
    inSurah: Schema.Finite,
  }),
});
type NumberedVerse = typeof NumberedVerseSchema.Type;

/** Checks that one verse list exactly covers the requested local range. */
export function hasExactQuranVerseRange(
  verses: readonly NumberedVerse[],
  fromVerse: number,
  toVerse: number
) {
  if (
    !(Number.isSafeInteger(fromVerse) && Number.isSafeInteger(toVerse)) ||
    fromVerse < 1 ||
    toVerse < fromVerse ||
    verses.length !== toVerse - fromVerse + 1
  ) {
    return false;
  }
  return verses.every(
    (verse, index) => verse.number.inSurah === fromVerse + index
  );
}

/** Checks the exact previous and next surah identities around one page. */
export function hasExpectedQuranNeighbors(
  previousSurah: null | NumberedSurah,
  nextSurah: null | NumberedSurah,
  surahNumber: number,
  surahCount: number
) {
  if (
    !(Number.isSafeInteger(surahNumber) && Number.isSafeInteger(surahCount)) ||
    surahNumber < 1 ||
    surahNumber > surahCount
  ) {
    return false;
  }
  const expectedPrevious = surahNumber === 1 ? null : surahNumber - 1;
  const expectedNext = surahNumber === surahCount ? null : surahNumber + 1;
  return (
    (previousSurah?.number ?? null) === expectedPrevious &&
    (nextSurah?.number ?? null) === expectedNext
  );
}
