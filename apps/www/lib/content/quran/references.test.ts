import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "vitest";
import { getQuranReferences } from "@/lib/content/quran/references";

const expectedSourceIds = {
  de: ["tanzil-text", "quranenc-german", "mokhtasar-german"],
  en: ["tanzil-text", "quranenc-english", "mokhtasar-english"],
  id: ["tanzil-text", "quranenc-indonesian", "quranenc-tafsir"],
} as const;

describe("Quran bibliography", () => {
  it("omits Tafsir only while access metadata is unavailable", () => {
    expect(getQuranReferences(makeQuranLocaleSources("en"), null)).toHaveLength(
      2
    );
  });

  it.each(["en", "id", "de"] as const)(
    "projects signed %s sources into the existing reference surface",
    (locale) => {
      const references = getQuranReferences(
        makeQuranLocaleSources(locale),
        makeQuranTafsirProjection(locale)
      );

      expect(references).toHaveLength(3);
      expect(references.map(({ title }) => title)).toEqual(
        expectedSourceIds[locale].map((id) => expect.stringContaining(id))
      );
      expect(
        references.every(({ url }) => url !== undefined && URL.canParse(url))
      ).toBe(true);
      expect(references.every(({ year }) => year === 2026)).toBe(true);
      const tafsirReference = references.at(-1);
      expect(tafsirReference?.details).toContain(
        makeQuranTafsirProjection(locale).notice
      );
      expect(tafsirReference?.details).toContain(
        makeQuranTafsirProjection(locale).source.terms.url
      );
      if (locale !== "id") {
        expect(tafsirReference?.details).toContain("Access: link-only");
      }
    }
  );
});
