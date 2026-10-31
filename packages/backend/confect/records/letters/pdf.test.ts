import { describe, expect, it } from "@effect/vitest";
import { PrintableLetter } from "@repo/backend/confect/records/letter";
import {
  drawLetterPdf,
  indonesianDate,
  indonesianValue,
} from "@repo/backend/confect/records/letters/pdf";
import { Effect, Schema, Struct } from "effect";

/** One SKL as its print reads it. */
const LETTER: typeof PrintableLetter.Type = Schema.decodeSync(PrintableLetter)({
  average: 85.5,
  cohort: "IX-A",
  date: "2027-06-07",
  decision: "421.3/045/SMP.1/2027",
  hash: "a".repeat(64),
  head: "Dra. Siti Aminah, M.Pd.",
  locale: "id",
  nip: "196501011990032001",
  nisn: "0012345678",
  npsn: "20212345",
  number: "421.3/045/SMP.1/2027/001",
  period: "Genap 2026/2027",
  place: "Bandung",
  school: "SMP Nakafa",
  student: "Siti Rahma",
  subjects: [
    { subject: "Bahasa Indonesia", value: 91 },
    { subject: "Matematika", value: 80 },
  ],
  verifyUrl: `https://nakafa.com/id/verify/${"a".repeat(64)}`,
});

describe("records/letters/pdf", () => {
  it("writes dates and values as Indonesian letters do", () => {
    expect(indonesianDate("2027-06-07")).toBe("7 Juni 2027");
    expect(indonesianDate("2026-12-19")).toBe("19 Desember 2026");
    expect(indonesianValue(85.5)).toBe("85,50");
    expect(indonesianValue(100)).toBe("100,00");
  });

  it.effect("draws an SKL as a PDF, with the head's NIP or a dash", () =>
    Effect.gen(function* () {
      for (const letter of [LETTER, Struct.omit(LETTER, ["nip"])]) {
        const bytes = yield* drawLetterPdf(letter);
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      }
    })
  );
});
