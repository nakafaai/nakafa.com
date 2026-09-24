import { describe, expect, it } from "@effect/vitest";
import { projectQuranVerse } from "@repo/backend/agent/quran/verse";
import { makeQuranChunk } from "@repo/backend/test/quran/rows";
import { Effect } from "effect";

const verse = makeQuranChunk({
  firstQuranNumber: 1,
  firstVerse: 1,
  surahNumber: 1,
  verseCount: 1,
}).verses[0];
if (!verse) {
  throw new Error("Expected a technical Quran verse.");
}

describe("signed Quran verse projection", () => {
  it.effect(
    "requires the selected translation without falling back to another locale",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          projectQuranVerse(
            {
              ...verse,
              translations: [
                verse.translations[0],
                ...verse.translations
                  .slice(1)
                  .filter(({ appLocale }) => appLocale !== "de"),
              ],
            },
            "de",
            false
          )
        );
        expect(error).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          cause: "Signed Quran verse 1 has no de translation.",
        });
      })
  );

  it.effect("fails closed on inconsistent signed translation notes", () =>
    Effect.gen(function* () {
      const translation = verse.translations[0];
      const error = yield* Effect.flip(
        projectQuranVerse(
          {
            ...verse,
            translations: [
              { ...translation, value: { text: "Text [99]", footnotes: "" } },
              ...verse.translations.slice(1),
            ],
          },
          translation.appLocale,
          false
        )
      );
      expect(error).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to read signed Nakafa Quran reference.",
      });
      expect(error.cause).toContain("inconsistent translation notes");
    })
  );

  it.effect(
    "requires requested Indonesian tafsir and omits it for other locales",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          projectQuranVerse({ ...verse, tafsir: [] }, "id", true)
        );
        expect(error).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          cause: "Signed Quran verse 1 has no Indonesian tafsir.",
        });
        expect(yield* projectQuranVerse(verse, "id", true)).toHaveProperty(
          "tafsir",
          "Tafsir teknis 1"
        );
        expect(yield* projectQuranVerse(verse, "en", true)).not.toHaveProperty(
          "tafsir"
        );
      })
  );
});
