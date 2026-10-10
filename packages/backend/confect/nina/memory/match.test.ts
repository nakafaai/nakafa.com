import { describe, expect, it } from "@effect/vitest";
import { sameWords, saysSame } from "@repo/backend/confect/nina/memory/match";

describe("memory same words", () => {
  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPA."],
    ["Kelas   12,IPA", "kelas 12 ipa"],
  ])("holds the same words in %j and %j", (first, second) => {
    expect(sameWords(first, second)).toBe(true);
  });

  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPS"],
    [
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang",
    ],
  ])("does not hold the same words in %j and %j", (first, second) => {
    expect(sameWords(first, second)).toBe(false);
  });
});

describe("memory text match", () => {
  it.each([
    ["Kelas 12 IPA", "kelas 12 ipa"],
    ["Kelas 12 IPA.", "Kelas   12, IPA"],
    ["Kelas 12,IPA", "kelas 12 ipa"],
    ["Mau ikut SNBT 2027!", "mau ikut snbt 2027"],
  ])("says %j and %j are the same", (first, second) => {
    expect(saysSame(first, second)).toBe(true);
  });

  it("says two texts are the same when their shared words are at least four fifths of all their words", () => {
    // Nine words against ten with all nine shared: 9 of 10.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang"
      )
    ).toBe(true);
    // One word changed in nine: 8 shared of 10 in all, exactly four fifths.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPS di SMA Negeri 1 Bandung"
      )
    ).toBe(true);
    // Two words changed in nine: 7 shared of 11 in all.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPS di SMA Negeri 2 Bandung"
      )
    ).toBe(false);
  });

  it.each([
    ["Kelas 12", "Kelas 11"],
    ["Mau ikut SNBT", "Mau ikut UTBK"],
    ["Suka contoh soal dulu", "Sulit di peluang"],
    ["Kelas 12", "..."],
  ])("says %j and %j are different", (first, second) => {
    expect(saysSame(first, second)).toBe(false);
  });
});
