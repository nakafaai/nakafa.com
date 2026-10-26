import { describe, expect, it } from "@effect/vitest";
import { drawReportPdf } from "@repo/backend/confect/records/pdf";
import { DateTime, Effect } from "effect";

/** A printable report with two subject lines, one judged by a band. */
const report = {
  approvedAt: DateTime.toEpochMillis(
    DateTime.makeUnsafe("2026-12-19T00:00:00Z")
  ),
  cohort: "X-1",
  hash: "a".repeat(64),
  locale: "id" as const,
  note: "Rajin dan teliti dalam mengerjakan tugas.",
  period: "Ganjil 2026/2027",
  school: "SMA Harapan",
  student: "Raka Pratama",
  subjects: [
    {
      band: "Baik",
      className: "Fisika X-1",
      kktp: "reached" as const,
      value: 86,
    },
    { className: "Kimia X-1", kktp: "notReached" as const, value: 70 },
  ],
  verifyUrl: `https://nakafa.com/id/verify/${"a".repeat(64)}`,
};

describe("records/pdf", () => {
  it.effect("draws one A4 PDF in every language a unit may set", () =>
    Effect.gen(function* () {
      for (const locale of ["id", "en", "de"] as const) {
        const bytes = yield* drawReportPdf({ ...report, locale });
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
        expect(bytes.byteLength).toBeGreaterThan(1000);
      }
    })
  );
});
