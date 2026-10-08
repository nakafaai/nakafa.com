import { readQuranTafsir } from "@repo/backend/confect/contentRelease/quran/translation";
import { loadQuranPassage } from "@repo/backend/content/quran/reference";
import type { quranInterpretationValidator } from "@repo/backend/content/quran/response";
import { readQuranLocaleSources } from "@repo/backend/content/quran/sources";
import { Effect } from "effect";

/** Exact signed tafsir response returned only after one verse is requested. */

type QuranInterpretation = typeof quranInterpretationValidator.Type;

/** Reads one exact Indonesian tafsir from its verified immutable chunk. */
export const readQuranInterpretation = Effect.fn(
  "contentRelease.readQuranInterpretation"
)(function* (
  appLocale: QuranInterpretation["appLocale"],
  expectedSnapshotId: string,
  sourceSurah: number,
  sourceVerse: number
) {
  const loaded = yield* loadQuranPassage({
    expectedSnapshotId,
    fromVerse: sourceVerse,
    surahNumber: sourceSurah,
    toVerse: sourceVerse,
  });
  // A required snapshot pin rejects absent ownership before loading a passage.
  const passage = yield* Effect.fromNullishOr(loaded.passage).pipe(
    Effect.orDie
  );
  const verse = yield* Effect.fromNullishOr(
    passage.chunks.rows
      .flatMap((chunk) => chunk.verses)
      .find(({ number }) => number.inSurah === loaded.input.fromVerse)
  ).pipe(Effect.orDie);
  const { tafsirAccess } = yield* readQuranLocaleSources(
    expectedSnapshotId,
    appLocale
  );
  const interpretation = yield* readQuranTafsir(verse, appLocale);
  const result: QuranInterpretation = {
    ...loaded.owner,
    appLocale,
    interpretation: interpretation.text,
    surahNumber: loaded.input.surahNumber,
    tafsirAccess,
    verseNumber: loaded.input.fromVerse,
  };
  return result;
});
