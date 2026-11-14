import { describe, expect, it } from "@effect/vitest";
import {
  foldWord,
  foldWords,
  isProperName,
  splitWords,
} from "@/lib/search/fold";

describe("foldWord", () => {
  it("folds case, accents, ligatures and umlauts as each locale's reader types them", () => {
    expect(foldWord("Fächer")).toBe("facher");
    expect(foldWord("Faecher")).toBe("facher");
    expect(foldWord("Straße")).toBe("strasse");
    expect(foldWord("Ærø")).toBe("aro");
    expect(foldWord("Œuvre")).toBe("ouvre");
    expect(foldWord("Łódź")).toBe("lodz");
    expect(foldWord("ılık")).toBe("ilik");
    expect(foldWord("Qurʾān")).toBe("qurʾan");
  });
});

describe("foldWords", () => {
  it("splits on anything but letters and digits, and between letters and digits", () => {
    expect(foldWords("Kelas10: Kimia (Atom)")).toEqual([
      "kelas",
      "10",
      "kimia",
      "atom",
    ]);
    expect(foldWords("Al-Baqarah")).toEqual(["al", "baqarah"]);
    expect(foldWords(" — ")).toEqual([]);
  });

  it("keeps an accented word whole", () => {
    expect(splitWords("Fächer für dich")).toEqual(["Facher", "fur", "dich"]);
  });
});

describe("isProperName", () => {
  it("knows an exam or a curriculum written in capitals", () => {
    expect(isProperName("SNBT")).toBe(true);
    expect(isProperName("KSSM")).toBe(true);
    expect(isProperName("A2")).toBe(true);
    expect(isProperName("Kimia")).toBe(false);
    expect(isProperName("A")).toBe(false);
  });
});
