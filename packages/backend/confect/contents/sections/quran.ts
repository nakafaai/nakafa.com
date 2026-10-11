import {
  ACTIVE_APP_LOCALE_CODES,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { projectQuranTranslation } from "@repo/backend/client/quran/notes";
import { readQuranTranslationDocument } from "@repo/backend/confect/contentRelease/quran/translation";
import { sectionOf } from "@repo/backend/confect/contents/sections/draft";
import type { surahInputValidator } from "@repo/backend/confect/contents/sections/schema";
import { readQuranChunks } from "@repo/backend/content/quran/chunks";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { readQuranSurahRow } from "@repo/backend/content/quran/surah";
import { Array as Arr, Effect, Option, String as Str } from "effect";

/**
 * One verse as plain text: its number and its Arabic, then its translation in
 * the language and, where that language has one, its tafsir.
 */
const verseText = Effect.fn("contents.sections.verseText")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode
) {
  const { document } = yield* readQuranTranslationDocument(verse, appLocale);
  const tafsir = Arr.findFirst(
    verse.tafsir,
    (entry) => entry.appLocale === appLocale
  );
  return Arr.join(
    Arr.filter(
      [
        `${verse.number.inSurah}. ${verse.text.arabic}`,
        projectQuranTranslation(document, () => "").text,
        Option.match(tafsir, { onNone: () => "", onSome: ({ text }) => text }),
      ],
      Str.isNonEmpty
    ),
    "\n"
  );
});

/**
 * Reads one surah of the active Quran as passages, one per signed chunk of
 * verses and language. The anchor of a passage is the section of its first
 * verse in the reader, which starts at `### Verse N`, so that the anchor opens
 * the surah at the passage. The answer is stale when `releaseId` names another
 * release than the active one, and `none` when the active release has no Quran.
 */
export const readSurah = Effect.fn("contents.sections.readSurah")(function* (
  input: typeof surahInputValidator.Type
) {
  const owner = yield* loadQuranOwner();
  if (
    owner.activeReleaseId === null ||
    (input.releaseId !== undefined && input.releaseId !== owner.activeReleaseId)
  ) {
    return { kind: "stale" as const };
  }
  if (owner.snapshotId === null) {
    return { kind: "none" as const, releaseId: owner.activeReleaseId };
  }
  const { payload: surah } = yield* readQuranSurahRow(
    owner.snapshotId,
    input.surah
  );
  const { rows } = yield* readQuranChunks({
    fromVerse: 1,
    numberOfVerses: surah.numberOfVerses,
    snapshotId: owner.snapshotId,
    surahNumber: input.surah,
    toVerse: surah.numberOfVerses,
  });
  const route = `quran/${surah.number}`;
  const passages = yield* Effect.forEach(ACTIVE_APP_LOCALE_CODES, (appLocale) =>
    Effect.forEach(rows, (chunk, ordinal) =>
      Effect.map(
        Effect.forEach(chunk.verses, (verse) => verseText(verse, appLocale)),
        (verses) =>
          sectionOf(
            {
              anchor: `verse-${chunk.firstVerse}`,
              appLocale,
              contentKey: route,
              count: rows.length,
              headingPath: [
                `${surah.name.transliteration} (surah ${surah.number})`,
                `Verses ${chunk.firstVerse}-${chunk.lastVerse}`,
              ],
              ordinal,
              publicPath: route,
              section: "quran",
            },
            `${surah.name.transliteration}: ${surah.name.meaning[appLocale]}`,
            Arr.join(verses, "\n")
          )
      )
    )
  );
  return {
    kind: "surah" as const,
    releaseId: owner.activeReleaseId,
    sections: Arr.flatten(passages),
  };
}, Effect.provide(quranLayer));
