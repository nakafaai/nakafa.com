import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranView } from "@repo/backend/client/quran/view";
import type { api } from "@repo/backend/convex/_generated/api";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};
const surah = {
  name: {
    translation: "Pembukaan",
    transliteration: "Al-Fatihah",
  },
  number: 1,
  numberOfVerses: 1,
};
type QuranViewResult = FunctionReturnType<typeof api.contentRelease.quran.view>;
describe("signed Quran view decoder", () => {
  it.live("preserves each validator-derived app-locale projection", () =>
    Effect.gen(function* () {
      const english = yield* decodePublishedQuranView(englishViewResult(), {
        appLocale: "en",
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
        translation: "In the name of Allah.",
      });
      expect(indonesian.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: "Dengan nama Allah.",
      });
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
            previousSurah: null,
            snapshotId: null,
            sourceRevision: null,
            surah: null,
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
function viewBase() {
  return {
    ...source,
    nextSurah: {
      ...surah,
      name: { ...surah.name, transliteration: "Al-Baqarah" },
      number: 2,
    },
    previousSurah: null,
    surah,
  };
}
/** Builds one complete English view response. */
function englishViewResult(): QuranViewResult {
  return {
    ...viewBase(),
    appLocale: "en",
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: "In the name of Allah.",
      },
    ],
  };
}
/** Builds one complete Indonesian view response. */
function indonesianViewResult(): QuranViewResult {
  return {
    ...viewBase(),
    appLocale: "id",
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: "Dengan nama Allah.",
      },
    ],
  };
}
