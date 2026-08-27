import {
  readQuranTafsir,
  readQuranTranslation,
} from "@repo/backend/convex/contentRelease/quran/translation";
import { makeQuranChunk } from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const verse = makeQuranChunk({
  firstQuranNumber: 1,
  firstVerse: 1,
  surahNumber: 1,
  verseCount: 1,
}).verses[0];
if (!verse) {
  throw new Error("Expected one technical Quran verse.");
}
describe("contentRelease/quran/translation", () => {
  it.live("selects exact reviewed translation and tafsir entries", () =>
    Effect.gen(function* () {
      const localized = yield* Effect.all({
        tafsir: readQuranTafsir(verse, "id"),
        translation: readQuranTranslation(verse, "en"),
      });
      expect(localized.translation.text).toBe("Technical translation 1");
      expect(localized.tafsir.text).toBe("Tafsir teknis 1");
    })
  );
  it.live("fails closed when the signed verse lacks an app locale", () =>
    Effect.gen(function* () {
      const results = yield* Effect.all({
        tafsir: Effect.result(readQuranTafsir({ ...verse, tafsir: [] }, "id")),
        translation: Effect.result(
          readQuranTranslation(
            {
              ...verse,
              translations: [
                verse.translations[0],
                ...verse.translations
                  .slice(1)
                  .filter(({ appLocale }) => appLocale !== "de"),
              ],
            },
            "de"
          )
        ),
      });
      for (const result of Object.values(results)) {
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { code: "CONTENT_RELEASE_INTEGRITY" },
        });
      }
    })
  );
});
