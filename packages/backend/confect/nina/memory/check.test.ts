import { describe, expect, it } from "@effect/vitest";
import {
  checkCandidates,
  endOfDay,
} from "@repo/backend/confect/nina/memory/check";
import type { NinaMemoryClaim } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Option } from "effect";

type Claim = typeof NinaMemoryClaim.Type;

const NOW = Date.UTC(2026, 9, 10, 15);
const message =
  "Aku kelas 12 dan  mau ikut SNBT\n2027. Ujian kimiaku 20 Oktober.";

/** A claim that quotes the learner, with any field replaced. */
function claim(fields: Partial<Claim> = {}): Claim {
  return {
    kind: "level",
    quote: "aku kelas 12",
    text: "Kelas 12.",
    ...fields,
  };
}

/** The text of each candidate a check keeps. */
function kept(claims: Claim[]) {
  return Arr.map(checkCandidates(message, claims, NOW), (item) => item.text);
}

describe("memory end of day", () => {
  it("names the last millisecond of a real UTC day", () => {
    expect(endOfDay("2026-10-20")).toEqual(
      Option.some(Date.UTC(2026, 9, 20, 23, 59, 59, 999))
    );
    expect(endOfDay("2028-02-29")).toEqual(
      Option.some(Date.UTC(2028, 1, 29, 23, 59, 59, 999))
    );
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2027-02-29",
    "20 Oktober",
    "tomorrow",
    "2026-10-20T10:00:00Z",
    "2026-1-5",
    "",
  ])("names nothing for %j", (text) => {
    expect(endOfDay(text)).toEqual(Option.none());
  });
});

describe("memory candidate check", () => {
  it("keeps a claim whose quote the learner said, in any case and spacing", () => {
    expect(
      kept([
        claim(),
        claim({
          kind: "goal",
          quote: "MAU   IKUT snbt 2027",
          text: "Ikut SNBT 2027.",
        }),
      ])
    ).toEqual(["Kelas 12.", "Ikut SNBT 2027."]);
  });

  it("drops a claim whose quote is not in the message or is blank", () => {
    expect(
      kept([
        claim({ quote: "aku kelas 11" }),
        claim({ quote: "   " }),
        claim({ quote: "ikut snbt 2028" }),
      ])
    ).toEqual([]);
  });

  it("drops a claim whose text says nothing, because it has no letter and no digit", () => {
    expect(
      kept([
        claim({ text: "?" }),
        claim({ text: "..." }),
        claim({ text: "🙂" }),
        claim({ text: "12" }),
        claim({ text: "Ya." }),
      ])
    ).toEqual(["12", "Ya."]);
  });

  it("leaves what a claim means to the decision model: it keeps a text that names the learner from outside, in any language, and one that holds a link, an address or a long number, and a quote that holds one", () => {
    expect(
      kept([
        claim({ text: "Learner berada di kelas 12." }),
        claim({ text: "Siswa kelas 12." }),
        claim({ text: "The learner is in grade 12." }),
        claim({ text: "Der Lernende ist in Klasse 12." }),
        claim({ text: "学習者は高校三年生です。" }),
        claim({ text: "Kontak nama@contoh.com." }),
        claim({ text: "Lihat https://contoh.com/saya." }),
        claim({ text: "Kontak www.contoh.com." }),
        claim({ text: "Nomor 081234567890." }),
        claim({ text: "Nomor 12345678." }),
        claim({ text: "SNBT 2027, kelas 12." }),
        claim({ text: "Ujian 20-10-2026 pukul 14.30." }),
      ])
    ).toHaveLength(12);
    const said = "Aku bisa dihubungi di nama@contoh.com dan 081234567890.";
    expect(
      checkCandidates(said, [claim({ quote: "nama@contoh.com" })], NOW)
    ).toHaveLength(1);
    expect(
      checkCandidates(said, [claim({ quote: "081234567890" })], NOW)
    ).toHaveLength(1);
  });

  it("keeps a situation that ends today or later and its date", () => {
    const today = claim({
      kind: "situation",
      quote: "ujian kimiaku 20 oktober",
      text: "Ujian kimia.",
      until: "2026-10-10",
    });
    const later = { ...today, until: "2026-10-20" };
    expect(checkCandidates(message, [today, later], NOW)).toEqual([
      today,
      later,
    ]);
  });

  it("drops a situation that names no day, has ended, or names no usable day", () => {
    const situation = claim({
      kind: "situation",
      quote: "ujian kimiaku 20 oktober",
      text: "Ujian kimia.",
    });
    expect(
      kept([
        situation,
        { ...situation, until: "2026-10-09" },
        { ...situation, until: "20 Oktober" },
        { ...situation, until: "2026-02-30" },
      ])
    ).toEqual([]);
  });

  it("drops only the claim that is no candidate, and keeps the claims beside it", () => {
    const situation = claim({
      kind: "situation",
      quote: "ujian kimiaku 20 oktober",
      text: "Ujian kimia.",
    });
    expect(
      kept([
        claim(),
        situation,
        { ...situation, until: "2026-02-30" },
        claim({ kind: "goal", quote: "mau ikut snbt", text: "Ikut SNBT." }),
      ])
    ).toEqual(["Kelas 12.", "Ikut SNBT."]);
  });

  it("gives every kind but a situation no date, though the claim names one", () => {
    expect(
      checkCandidates(message, [claim({ until: "2020-01-01" })], NOW)
    ).toEqual([claim()]);
  });
});
