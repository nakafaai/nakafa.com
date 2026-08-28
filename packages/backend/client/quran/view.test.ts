import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranView } from "@repo/backend/client/quran/view";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
const surah = {
  name: {
    sourceMeaning: { appLocale: "en" as const, text: "The Opening" },
    transliteration: "Al-Fatihah",
  },
  number: 1,
  numberOfVerses: 1,
};
type QuranViewResult = FunctionReturnType<typeof api.contentRelease.quran.page>;
describe("signed Quran view decoder", () => {
  it.live("preserves each validator-derived app-locale projection", () =>
    Effect.gen(function* () {
      const english = yield* decodePublishedQuranView(englishViewResult(), {
        appLocale: "en",
        surahNumber: 1,
      });
      const german = yield* decodePublishedQuranView(germanViewResult(), {
        appLocale: "de",
        surahNumber: 1,
      });
      const indonesian = yield* decodePublishedQuranView(
        indonesianViewResult(),
        {
          appLocale: "id",
          surahNumber: 1,
        }
      );
      expect(english.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 1,
              referenceOffset: 20,
              text: "English translation note.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "In the name of Allah" },
            { kind: "note", number: 1, offset: 20 },
            { kind: "text", offset: 23, value: "." },
          ],
        },
      });
      expect(german.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [],
          segments: [{ kind: "text", offset: 0, value: "Im Namen Allahs." }],
        },
      });
      expect(indonesian.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 18,
              text: "Catatan terjemahan Indonesia.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Dengan nama Allah." },
            { kind: "note", number: 4, offset: 18 },
          ],
        },
      });
      expect(english.surah.name.meaning).toEqual({
        appLocale: "en",
        text: "The Opening",
      });
      expect(german.surah.name.meaning).toEqual({
        appLocale: "en",
        text: "The Opening",
      });
      expect(indonesian.surah.name.meaning).toEqual({
        appLocale: "en",
        text: "The Opening",
      });
      expect(english.tafsirAccess).toMatchObject({
        appLocale: "en",
        kind: "external",
      });
      expect(german.tafsirAccess).toMatchObject({
        appLocale: "de",
        kind: "external",
      });
      expect(indonesian.tafsirAccess).toEqual(makeQuranTafsirProjection("id"));
      expect(JSON.stringify(indonesian)).not.toContain("Tafsir lengkap");
    })
  );
  it.live("fails closed for inactive and inconsistent views", () =>
    Effect.gen(function* () {
      const inactive = yield* Effect.result(
        decodePublishedQuranView(
          {
            activeManifestHash: null,
            activeReleaseId: null,
            appLocale: "en",
            managed: false,
            nextSurah: null,
            preBismillah: null,
            previousSurah: null,
            snapshotId: null,
            sourceOrigin: null,
            sourceRevision: null,
            sources: null,
            surah: null,
            tafsirAccess: null,
            verses: [],
          },
          { appLocale: "en", surahNumber: 1 }
        )
      );
      const inconsistent = yield* Effect.result(
        decodePublishedQuranView(englishViewResult(), {
          appLocale: "en",
          surahNumber: 2,
        })
      );
      expect(inactive._tag).toBe("Failure");
      expect(inconsistent._tag).toBe("Failure");
    })
  );
});
/** Builds source and metadata shared by app-locale view fixtures. */
function viewBase(meaning: string | null) {
  return {
    ...source,
    nextSurah: {
      ...surah,
      name: { ...surah.name, meaning, transliteration: "Al-Baqarah" },
      number: 2,
    },
    previousSurah: null,
    surah: { ...surah, name: { ...surah.name, meaning } },
  };
}
/** Builds one complete English view response. */
function englishViewResult(): QuranViewResult {
  return {
    ...viewBase("The Opening"),
    appLocale: "en",
    preBismillah: null,
    sources: makeQuranLocaleSources("en"),
    tafsirAccess: makeQuranTafsirProjection("en"),
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 1,
              referenceOffset: 20,
              text: "English translation note.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "In the name of Allah" },
            { kind: "note", number: 1, offset: 20 },
            { kind: "text", offset: 23, value: "." },
          ],
        },
      },
    ],
  };
}
/** Builds one complete German view response without invented source notes. */
function germanViewResult(): QuranViewResult {
  return {
    ...viewBase(null),
    appLocale: "de",
    preBismillah: null,
    sources: makeQuranLocaleSources("de"),
    tafsirAccess: makeQuranTafsirProjection("de"),
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [],
          segments: [{ kind: "text", offset: 0, value: "Im Namen Allahs." }],
        },
      },
    ],
  };
}
/** Builds one complete Indonesian view response. */
function indonesianViewResult(): QuranViewResult {
  return {
    ...viewBase(null),
    appLocale: "id",
    preBismillah: null,
    sources: makeQuranLocaleSources("id"),
    tafsirAccess: makeQuranTafsirProjection("id"),
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 18,
              text: "Catatan terjemahan Indonesia.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Dengan nama Allah." },
            { kind: "note", number: 4, offset: 18 },
          ],
        },
      },
    ],
  };
}
