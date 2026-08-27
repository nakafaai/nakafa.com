import {
  separateQuranBismillah,
  splitQuranBismillahPrefix,
} from "@repo/backend/content/quran/bismillah";
import { describe, expect, it } from "vitest";

const bismillah = {
  arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  translation: "In the Name of Allah, the Most Compassionate, Most Merciful.",
};

describe("Quran Bismillah presentation", () => {
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
