import { describe, expect, it } from "@effect/vitest";
import { hasWords, sameWords } from "@repo/backend/confect/nina/memory/match";

describe("memory words", () => {
  it.each(["Kelas 12", "12", "SNBT", "...kelas!", "الرياضيات", "数学"])(
    "finds a word in %j",
    (text) => {
      expect(hasWords(text)).toBe(true);
    }
  );

  it.each(["", "   ", "?", "...", "🙂", " - ! "])(
    "finds no word in %j",
    (text) => {
      expect(hasWords(text)).toBe(false);
    }
  );
});

describe("memory same words", () => {
  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPA."],
    ["Kelas   12,IPA", "kelas 12 ipa"],
    ["確率が苦手です。", "確率が苦手です"],
  ])("holds the same words in %j and %j", (first, second) => {
    expect(sameWords(first, second)).toBe(true);
  });

  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPS"],
    [
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang",
    ],
    ["確率が苦手です", "確率がとても苦手です"],
  ])(
    "does not hold the same words in %j and %j, though they may say the same thing",
    (first, second) => {
      expect(sameWords(first, second)).toBe(false);
    }
  );
});
