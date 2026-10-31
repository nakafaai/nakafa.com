import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Array as Arr, Schema } from "effect";
import {
  fileStem,
  type GraduationOverview,
  type LedgerRow,
  ledgerWorkbook,
  type ReadinessRow,
  readinessWorkbook,
} from "@/components/tenant/graduation/workbook";

const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const letterOf = Schema.decodeUnknownSync(Id("graduationLetters"));
const nisn = Schema.decodeSync(Nisn)("0012345678");

/** A graduating class group's page with a decision, or without one. */
const overview = (
  decision: GraduationOverview["decision"]
): GraduationOverview => ({
  can: [],
  cohort: {
    id: Schema.decodeUnknownSync(Id("tenantCohorts"))("ix-a"),
    name: "IX-A",
    period: "Genap 2026/2027",
    periodId: Schema.decodeUnknownSync(Id("tenantPeriods"))("genap"),
  },
  decision,
  suggested: "2027-06-07",
  unit: { name: "SMP Nakafa", npsn: null },
});

/** Siti, ready, with her SKL and two subjects. */
const siti: ReadinessRow = {
  hasNisn: true,
  letter: {
    file: null,
    hash: "a".repeat(64),
    id: letterOf("skl-siti"),
    number: "421.3/045/001",
    state: "locked",
  },
  missing: [],
  nisn,
  student: { id: personOf("siti"), name: "Siti" },
  transcript: {
    average: 85.5,
    subjects: [
      { subject: "Bahasa Indonesia", value: 91 },
      { subject: "Matematika", value: 80 },
    ],
  },
};

/** Andi, with no NISN and no locked report card. */
const andi: ReadinessRow = {
  hasNisn: false,
  letter: null,
  missing: ["npsn", "decision", "nisn", "report"],
  nisn: null,
  student: { id: personOf("andi"), name: "andi" },
  transcript: null,
};

describe("readinessWorkbook", () => {
  it("writes one row per student by name, a column per subject, the average, and what is missing", () => {
    const [sheet, notes] = readinessWorkbook(
      overview({
        date: "2027-06-07",
        decision: "421.3/045",
        head: "Dra. Siti",
        issued: 1,
        place: "Bandung",
      }),
      [siti, andi]
    );
    expect(sheet?.sheet).toBe("Kesiapan e-Ijazah");
    expect(sheet?.data).toEqual([
      [
        "No",
        "Nama Satuan Pendidikan",
        "NPSN",
        "Nama Lengkap",
        "NISN",
        "Rombel",
        "Nomor Keputusan Penetapan Kelulusan",
        "Tanggal Kelulusan",
        "Nomor SKL",
        "Bahasa Indonesia",
        "Matematika",
        "Rata-rata",
        "Kekurangan Data",
      ],
      [
        1,
        "SMP Nakafa",
        null,
        "andi",
        null,
        "IX-A",
        "421.3/045",
        "2027-06-07",
        null,
        null,
        null,
        null,
        "NPSN satuan pendidikan; Keputusan penetapan kelulusan; NISN; Rapor terkunci di rombel",
      ],
      [
        2,
        "SMP Nakafa",
        null,
        "Siti",
        nisn,
        "IX-A",
        "421.3/045",
        "2027-06-07",
        "421.3/045/001",
        { format: "0.00", value: 91 },
        { format: "0.00", value: 80 },
        { format: "0.00", value: 85.5 },
        "",
      ],
    ]);
    expect(notes?.sheet).toBe("Keterangan");
  });

  it("leaves the decision's cells empty before the principal records it", () => {
    const [sheet] = readinessWorkbook(overview(null), [siti]);
    expect(Arr.take(Arr.drop(sheet?.data[1] ?? [], 6), 2)).toEqual([
      null,
      null,
    ]);
  });
});

/** One student of the Dapodik export. */
const ledgerRow = (
  name: string,
  subjects: LedgerRow["subjects"]
): LedgerRow => ({ name, nisn: null, subjects });

describe("ledgerWorkbook", () => {
  it("writes the Legger and one sheet per subject, each student by name, empty before the lock", () => {
    const long = "Pendidikan Agama Islam dan Budi Pekerti Kelas Akhir";
    const sheets = ledgerWorkbook([
      ledgerRow("Siti", [
        { className: "IX-A", kktp: "reached", value: 88 },
        {
          className: "Fisika IX-A",
          kktp: "reached",
          subject: "Fisika",
          value: 82,
        },
        {
          className: `${long} 1`,
          kktp: "reached",
          subject: `${long} 1`,
          value: 90,
        },
        {
          className: `${long} 2`,
          kktp: "reached",
          subject: `${long} 2`,
          value: 91,
        },
        {
          className: "Seni: Musik",
          kktp: "reached",
          subject: "Seni: Musik",
          value: 80,
        },
      ]),
      ledgerRow("Andi", null),
    ]);
    expect(Arr.map(sheets, (sheet) => sheet.sheet)).toEqual([
      "Legger",
      "Fisika",
      "IX-A",
      "Pendidikan Agama Islam dan Budi",
      "Pendidikan Agama Islam dan (2)",
      "Seni  Musik",
    ]);
    expect(sheets[0]?.data).toEqual([
      [
        "No",
        "Nama Peserta Didik",
        "NISN",
        "Fisika",
        "IX-A",
        `${long} 1`,
        `${long} 2`,
        "Seni: Musik",
      ],
      [1, "Andi", null, null, null, null, null, null],
      [2, "Siti", null, 82, 88, 90, 91, 80],
    ]);
    expect(sheets[1]?.data).toEqual([
      ["No", "Nama Peserta Didik", "NISN", "Nilai"],
      [1, "Andi", null, null],
      [2, "Siti", null, 82],
    ]);
  });
});

describe("fileStem", () => {
  it("names a file by the class group's letters and digits", () => {
    expect(fileStem("IX-A (Unggulan)")).toBe("ix-a-unggulan");
  });
});
