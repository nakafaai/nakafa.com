import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";

/** The signed source identity that every Quran response carries. */
export const quranSource = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: {
    kind: "git" as const,
    sha: "c".repeat(40),
  },
  sourceRevision: "c".repeat(40),
};

/** Builds one narrow locale-specific Quran web response. */
export function viewResult() {
  return {
    ...quranSource,
    appLocale: "id",
    nextSurah: {
      name: {
        sourceMeaning: makeQuranMeaning(2),
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    },
    previousSurah: null,
    surah: {
      name: {
        sourceMeaning: makeQuranMeaning(1),
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
    },
    sources: makeQuranLocaleSources("id"),
    tafsirAccess: makeQuranTafsirProjection("id"),
    verses: [
      {
        arabic: "آية 1",
        number: {
          inQuran: 1,
          inSurah: 1,
        },
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 20,
              text: "Catatan terjemahan Indonesia.",
            },
          ],
          segments: [
            {
              kind: "text",
              offset: 0,
              value: "Terjemahan teknis 1.",
            },
            {
              kind: "note",
              number: 4,
              offset: 20,
            },
          ],
        },
      },
    ],
  };
}

/** Builds the final Quran web response with no next neighbor. */
export function finalViewResult() {
  const result = viewResult();
  const previousSurah = makeQuranSurah(113);
  const surah = makeQuranSurah(114);
  return {
    ...result,
    nextSurah: null,
    previousSurah: {
      ...previousSurah,
      name: {
        sourceMeaning: previousSurah.name.meaning,
        transliteration: previousSurah.name.transliteration,
      },
      numberOfVerses: 1,
    },
    surah: {
      ...surah,
      name: {
        sourceMeaning: surah.name.meaning,
        transliteration: surah.name.transliteration,
      },
      numberOfVerses: 1,
    },
  };
}
