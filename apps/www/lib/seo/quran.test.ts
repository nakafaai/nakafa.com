// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { Effect } from "effect";
import { generateQuranMetadata } from "@/lib/seo/quran";

const { mockGetTranslations } = vi.hoisted(() => ({
  mockGetTranslations: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

const surah = {
  kind: "quran-surah",
  name: {
    arabic: "Al-Fatihah",
    meaning: { de: "Die Eröffnende", en: "The Opening", id: "Pembuka" },
    transliteration: "Al-Fatihah",
  },
  number: 1,
  numberOfVerses: 7,
  revelation: { order: 5, place: "Meccan" },
} satisfies QuranSurahRow;

/** Reads a mocked translation value as display text. */
function getValue(
  values: { readonly [key: string]: number | string | undefined },
  key: string
) {
  return String(values[key] ?? "");
}

describe("generateQuranMetadata", () => {
  beforeEach(() => {
    mockGetTranslations.mockReset();
    mockGetTranslations.mockResolvedValue(
      (
        key: string,
        values: { readonly [key: string]: number | string | undefined } = {}
      ) => {
        if (key === "quran.description") {
          return `Read Surah ${getValue(values, "name")} with ${getValue(values, "numberOfVerses")} verses.`;
        }
        if (key === "quran.keywords") {
          return [
            getValue(values, "name"),
            getValue(values, "translation"),
            getValue(values, "revelation"),
          ]
            .filter((value) => value !== "__EMPTY__")
            .join(", ");
        }
        const translation = getValue(values, "translation");
        const translationSuffix =
          translation === "__EMPTY__" ? "" : ` - ${translation}`;
        return `Surah ${getValue(values, "number")}. ${getValue(values, "name")}${translationSuffix} | Nakafa`;
      }
    );
  });

  it.effect("generates Quran metadata from the surah payload", () =>
    Effect.gen(function* () {
      const result = yield* generateQuranMetadata(surah, "en");

      expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
      expect(result.description).toBe("Read Surah Al-Fatihah with 7 verses.");
    })
  );

  it.effect(
    "uses the same authenticated Quran names in every shell locale",
    () =>
      Effect.gen(function* () {
        const result = yield* generateQuranMetadata(surah, "id");

        expect(result.title).toBe("Surah 1. Al-Fatihah - Pembuka | Nakafa");
        expect(result.keywords).toEqual(["Al-Fatihah", "Pembuka", "Meccan"]);
      })
  );
});
