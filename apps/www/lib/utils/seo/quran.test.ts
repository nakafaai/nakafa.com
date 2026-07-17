// @vitest-environment node

import type { RuntimeQuranSurahMetadata } from "@repo/backend/client/nakafa/types";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuranMetadata } from "@/lib/utils/seo/quran";

const { mockGetTranslations } = vi.hoisted(() => ({
  mockGetTranslations: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

const surah = {
  name: {
    long: "الفاتحة",
    short: "Al-Fatihah",
    translation: { en: "The Opening", id: "Pembukaan" },
    transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
  },
  number: 1,
  numberOfVerses: 7,
  preBismillah: null,
  revelation: { arab: "مكة", en: "Meccan", id: "Makkiyah" },
  sequence: 5,
} satisfies RuntimeQuranSurahMetadata;

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

  it("uses Quran labels from the requested locale", async () => {
    const result = await Effect.runPromise(generateQuranMetadata(surah, "id"));

    expect(result.title).toBe("Surah 1. Al-Fatihah - Pembukaan | Nakafa");
    expect(result.keywords).toEqual(["Al-Fatihah", "Pembukaan", "Makkiyah"]);
  });
});
