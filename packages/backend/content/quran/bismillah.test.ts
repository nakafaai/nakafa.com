import { describe, expect, it } from "@effect/vitest";
import {
  separateQuranBismillah,
  separateQuranRuntimeBismillah,
  splitQuranBismillahPrefix,
} from "@repo/backend/content/quran/bismillah";
import { makeQuranChunk } from "@repo/backend/test/quran/rows";

const bismillah = {
  arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  translation: {
    notes: [
      {
        number: 1,
        referenceOffset: 20,
        text: "A reviewed translation note.",
      },
    ],
    segments: [
      { kind: "text", offset: 0, value: "In the Name of Allah" },
      { kind: "note", number: 1, offset: 20 },
    ],
  },
};

describe("Quran Bismillah presentation", () => {
  it.each(["بِسْمِ", `${bismillah.arabic}   `])(
    "preserves an incomplete prefix or a prefix without verse text: %s",
    (arabic) => {
      const { verses } = makeQuranChunk({
        arabicText: arabic,
        firstQuranNumber: 8,
        firstVerse: 1,
        surahNumber: 2,
        verseCount: 2,
      });
      expect(separateQuranRuntimeBismillah(bismillah, verses)).toEqual({
        preBismillah: null,
        verses,
      });
    }
  );
  it("retains translations, notes, and verse metadata when separating runtime Arabic", () => {
    const { verses } = makeQuranChunk({
      arabicText: `${bismillah.arabic} الٓمٓ`,
      firstQuranNumber: 8,
      firstVerse: 1,
      surahNumber: 2,
      translationFootnotes: { en: "[1] Reviewed English note." },
      translationText: { en: "Alif Lam Mim.[1]" },
      verseCount: 2,
    });
    const [first, ...remaining] = verses;
    expect(separateQuranRuntimeBismillah(bismillah, verses)).toEqual({
      preBismillah: bismillah,
      verses: [
        { ...first, text: { ...first.text, arabic: "الٓمٓ" } },
        ...remaining,
      ],
    });
  });
  it("separates Al-Baqarah verse 1 without changing its Arabic suffix", () => {
    expect(
      separateQuranBismillah(bismillah, [
        {
          arabic: `${bismillah.arabic} الٓمٓ`,
          number: { inQuran: 8, inSurah: 1 },
        },
      ])
    ).toEqual({
      preBismillah: bismillah,
      verses: [{ arabic: "الٓمٓ", number: { inQuran: 8, inSurah: 1 } }],
    });
  });

  it("does not split Al-Fatihah or At-Tawbah", () => {
    expect(
      separateQuranBismillah(bismillah, [{ arabic: bismillah.arabic }])
    ).toEqual({ preBismillah: null, verses: [{ arabic: bismillah.arabic }] });
    expect(
      separateQuranBismillah(bismillah, [{ arabic: "بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ" }])
    ).toEqual({
      preBismillah: null,
      verses: [{ arabic: "بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ" }],
    });
  });

  it("accepts source diacritic variants while preserving exact verse bytes", () => {
    const verse = "وَٱلتِّينِ وَٱلزَّيْتُونِ";
    expect(
      splitQuranBismillahPrefix(
        `بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ${verse}`,
        bismillah.arabic
      )
    ).toBe(verse);
  });

  it("rejects a lookalike prefix without a source separator", () => {
    expect(
      splitQuranBismillahPrefix(`${bismillah.arabic}وَٱلتِّينِ`, bismillah.arabic)
    ).toBeNull();
  });
});
