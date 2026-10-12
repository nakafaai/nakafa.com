import {
  ACTIVE_APP_LOCALE_CODES,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { projectQuranTranslation } from "@repo/backend/client/quran/notes";
import { readQuranTranslationDocument } from "@repo/backend/confect/contentRelease/quran/translation";
import {
  sectionOf,
  sourceVersion,
} from "@repo/backend/confect/contents/sections/draft";
import type { surahInputValidator } from "@repo/backend/confect/contents/sections/schema";
import { holdsVersion } from "@repo/backend/confect/contents/sections/source";
import { readQuranChunks } from "@repo/backend/content/quran/chunks";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { readQuranSurahRow } from "@repo/backend/content/quran/surah";
import { Array as Arr, Effect, Option, String as Str } from "effect";

/** The documents of a surah, one for each language: the route of the surah names them all. */
const surahRoute = (surah: number) => `quran/${surah}`;

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

/** Whether the index holds the passages of a surah in every language, made from `version`. */
const holdsSurah = Effect.fn("contents.sections.holdsSurah")(function* (
  surah: number,
  version: string
) {
  const held = yield* Effect.forEach(ACTIVE_APP_LOCALE_CODES, (appLocale) =>
    holdsVersion({ appLocale, contentKey: surahRoute(surah) }, version)
  );
  return Arr.every(held, (found) => found);
});

/**
 * Reads the first surah at or after `input.surah` of the active Quran whose
 * passages the index lacks or holds at another version, as one document for
 * each language, one passage per signed chunk of verses. The anchor of a
 * passage is the section of its first verse in the reader, which starts at
 * `### Verse N`, so that the anchor opens the surah at the passage. The version
 * of a document is the snapshot of the Quran it was made from, so a surah
 * passes untouched from one release to the next while the snapshot stays the
 * same. The answer is stale when `releaseId` names another release than the
 * active one, and `done` when no surah is left, which is also what a release
 * without a Quran gives.
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
    return {
      kind: "done" as const,
      releaseId: owner.activeReleaseId,
      unchanged: 0,
    };
  }
  const version = sourceVersion(owner.snapshotId);
  const changed = yield* Effect.findFirst(
    Arr.range(input.surah, QURAN_SURAH_COUNT),
    (surah) => Effect.map(holdsSurah(surah, version), (held) => !held)
  );
  if (Option.isNone(changed)) {
    return {
      kind: "done" as const,
      releaseId: owner.activeReleaseId,
      unchanged:
        (QURAN_SURAH_COUNT - input.surah + 1) * ACTIVE_APP_LOCALE_CODES.length,
    };
  }
  const number = changed.value;
  const { payload: surah } = yield* readQuranSurahRow(owner.snapshotId, number);
  const { rows } = yield* readQuranChunks({
    fromVerse: 1,
    numberOfVerses: surah.numberOfVerses,
    snapshotId: owner.snapshotId,
    surahNumber: number,
    toVerse: surah.numberOfVerses,
  });
  const route = surahRoute(number);
  const documents = yield* Effect.forEach(
    ACTIVE_APP_LOCALE_CODES,
    (appLocale) =>
      Effect.map(
        Effect.forEach(rows, (chunk, ordinal) =>
          Effect.map(
            Effect.forEach(chunk.verses, (verse) =>
              verseText(verse, appLocale)
            ),
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
        ),
        (sections) => ({
          appLocale,
          contentKey: route,
          sections,
          section: "quran" as const,
          version,
        })
      )
  );
  return {
    documents,
    kind: "surah" as const,
    releaseId: owner.activeReleaseId,
    surah: number,
    unchanged: (number - input.surah) * ACTIVE_APP_LOCALE_CODES.length,
  };
}, Effect.provide(quranLayer));
