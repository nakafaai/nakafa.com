// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuranSurah } from "@/lib/utils/pages/quran";
import { generateQuranMetadata } from "@/lib/utils/seo/quran";

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
    translation: "The Opening",
    transliteration: "Al-Fatihah",
  },
  number: 1,
  numberOfVerses: 7,
  revelation: { order: 5, place: "Meccan" },
} satisfies QuranSurah;

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
          return `${getValue(values, "name")}, ${getValue(values, "translation")}, ${getValue(values, "revelation")}`;
        }
        return `Surah ${getValue(values, "number")}. ${getValue(values, "name")} - ${getValue(values, "translation")} | Nakafa`;
      }
    );
  });

  it("generates Quran metadata from the surah payload", async () => {
    const result = await Effect.runPromise(generateQuranMetadata(surah, "en"));

    expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
    expect(result.description).toBe("Read Surah Al-Fatihah with 7 verses.");
  });

  it("uses the same authenticated Quran names in every shell locale", async () => {
    const result = await Effect.runPromise(generateQuranMetadata(surah, "id"));

    expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
    expect(result.keywords).toEqual(["Al-Fatihah", "The Opening", "Meccan"]);
  });
});
