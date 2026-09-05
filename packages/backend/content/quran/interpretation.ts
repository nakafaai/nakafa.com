import { loadQuranPassage } from "@repo/backend/content/quran/reference";
import { readQuranLocaleSources } from "@repo/backend/content/quran/sources";
import {
  quranSourceFields,
  quranTafsirAccessValidator,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { readQuranTafsir } from "@repo/backend/convex/contentRelease/quran/translation";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

/** Exact signed tafsir response returned only after one verse is requested. */
export const quranInterpretationValidator = v.object({
  ...quranSourceFields,
  appLocale: quranTafsirAppLocaleValidator,
  interpretation: v.union(v.string(), v.null()),
  surahNumber: v.number(),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  verseNumber: v.number(),
});

type QuranInterpretation = Infer<typeof quranInterpretationValidator>;

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
