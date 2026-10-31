import type { Ref } from "@confect/core";
import type records from "@repo/backend/confect/_generated/refs/records";
import { Array as Arr, Option, Order, Schema } from "effect";

/** One e-Ijazah readiness row, as the graduation page reads it. */
export type ReadinessRow = Ref.Returns<
  typeof records.graduations.readiness
>["page"][number];

/** A graduating class group's page, as the graduation page reads it. */
export type GraduationOverview = Ref.Returns<typeof records.graduations.get>;

/** One student of a class group in the Dapodik export of report data. */
export type LedgerRow = Ref.Returns<
  typeof records.exports.ledger
>["page"][number];

/** A cell of a written sheet: text, a number, a number shown with its format, or empty. */
const Cell = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Struct({ format: Schema.String, value: Schema.Finite }),
  Schema.Null,
]);

/** One sheet of a workbook: its name, which a spreadsheet shows on its tab, and its rows. */
export const Sheet = Schema.Struct({
  data: Schema.Array(Schema.Array(Cell)),
  sheet: Schema.String,
});

type SheetRow = readonly (typeof Cell.Type)[];

/** The most characters a spreadsheet allows in a sheet's name. */
const SHEET_NAME_LIMIT = 31;

/** Characters a spreadsheet refuses in a sheet's name. */
const SHEET_NAME_REFUSED = /[[\]:*?/\\]/gu;

/** A transcript value as a number cell that shows two decimals (Kepmendikdasmen 177/2026, Lampiran II B.6). */
const twoDecimals = (value: number) => ({ format: "0.00", value });

/** Orders rows by their student's name, without regard to case. */
const byName = <A>(nameOf: (row: A) => string) =>
  Order.mapInput(Order.String, (row: A) => nameOf(row).toLowerCase());

/** The names in the order of their lowercase forms, each once without regard to case. */
const namesOf = (names: readonly string[]) =>
  Arr.sort(
    Arr.dedupeWith(names, (a, b) => a.toLowerCase() === b.toLowerCase()),
    Order.mapInput(Order.String, (name: string) => name.toLowerCase())
  );

/** What each missing fact is called in the readiness export, in Indonesian. */
const MISSING_LABELS = {
  decision: "Keputusan penetapan kelulusan",
  nisn: "NISN",
  npsn: "NPSN satuan pendidikan",
  report: "Rapor terkunci di rombel",
} as const satisfies Record<ReadinessRow["missing"][number], string>;

/** The notes sheet of the readiness export: where each field the export leaves out comes from. */
const READINESS_NOTES: typeof Sheet.Type = {
  data: [
    ["Kolom", "Sumber"],
    [
      "NIK, Tempat Lahir, Tanggal Lahir",
      "Diambil sistem e-Ijazah dari Dapodik setelah dipadankan dengan Dukcapil. Nakafa tidak menyimpannya.",
    ],
    [
      "Nomor Ijazah Nasional",
      "Diterbitkan sistem e-Ijazah setelah Daftar Nominasi Tetap.",
    ],
    [
      "Nomor Transkrip Nilai",
      "Diisi satuan pendidikan saat menerbitkan transkrip nilai.",
    ],
    [
      "Nilai mata pelajaran dan Rata-rata",
      "Rata-rata nilai rapor terkunci di satuan pendidikan, skala 0-100, dibulatkan dua angka di belakang koma (Kepmendikdasmen 177/2026, Lampiran II).",
    ],
  ],
  sheet: "Keterangan",
};

/**
 * The e-Ijazah readiness workbook of one class group (ADR 0033, S6): one row per student, by
 * name, in the order of Permendikbudristek 58/2024 Pasal 4 ayat (2) for the fields Nakafa holds,
 * one column per subject of any student's transcript, the average, and what is missing; and a
 * notes sheet that names the fields the e-Ijazah system takes from Dapodik.
 */
export const readinessWorkbook = (
  overview: GraduationOverview,
  rows: readonly ReadinessRow[]
): readonly (typeof Sheet.Type)[] => {
  const subjects = namesOf(
    Arr.flatMap(rows, (row) =>
      Arr.map(row.transcript?.subjects ?? [], (line) => line.subject)
    )
  );
  const header = [
    "No",
    "Nama Satuan Pendidikan",
    "NPSN",
    "Nama Lengkap",
    "NISN",
    "Rombel",
    "Nomor Keputusan Penetapan Kelulusan",
    "Tanggal Kelulusan",
    "Nomor SKL",
    ...subjects,
    "Rata-rata",
    "Kekurangan Data",
  ];
  const data = Arr.map(
    Arr.sort(
      rows,
      byName((row: ReadinessRow) => row.student.name)
    ),
    (row, index): SheetRow => [
      index + 1,
      overview.unit.name,
      overview.unit.npsn,
      row.student.name,
      row.nisn,
      overview.cohort.name,
      overview.decision?.decision ?? null,
      overview.decision?.date ?? null,
      row.letter?.number ?? null,
      ...Arr.map(subjects, (subject) =>
        Option.getOrNull(
          Option.map(
            Arr.findFirst(
              row.transcript?.subjects ?? [],
              (line) => line.subject.toLowerCase() === subject.toLowerCase()
            ),
            (line) => twoDecimals(line.value)
          )
        )
      ),
      row.transcript === null ? null : twoDecimals(row.transcript.average),
      Arr.join(
        Arr.map(row.missing, (missing) => MISSING_LABELS[missing]),
        "; "
      ),
    ]
  );
  return [
    { data: [header, ...data], sheet: "Kesiapan e-Ijazah" },
    READINESS_NOTES,
  ];
};

/** The subject a report line counts under in the Dapodik export: its class's subject, or its class name. */
const subjectOf = (line: NonNullable<LedgerRow["subjects"]>[number]) =>
  line.subject ?? line.className;

/** The value a student's locked report card gives a subject, or none. */
const gradeOf = (row: LedgerRow, subject: string) =>
  Option.getOrNull(
    Option.map(
      Arr.findFirst(
        row.subjects ?? [],
        (line) => subjectOf(line).toLowerCase() === subject.toLowerCase()
      ),
      (line) => line.value
    )
  );

/**
 * A sheet's name a spreadsheet takes for a subject: the characters it refuses dropped, cut to
 * its limit, and a number after a name an earlier sheet already took.
 */
const sheetNames = (subjects: readonly string[]) =>
  Arr.reduce(subjects, Arr.empty<string>(), (taken, subject) => {
    const base = subject
      .replace(SHEET_NAME_REFUSED, " ")
      .trim()
      .slice(0, SHEET_NAME_LIMIT);
    const count = Arr.filter(taken, (name) =>
      name.toLowerCase().startsWith(base.toLowerCase())
    ).length;
    const suffix = ` (${count + 1})`;
    return Arr.append(
      taken,
      count === 0
        ? base
        : `${base.slice(0, SHEET_NAME_LIMIT - suffix.length).trimEnd()}${suffix}`
    );
  });

/**
 * The Dapodik workbook of one class group's report data (ADR 0033, S6): a Legger sheet with each
 * student by name, their NISN, and one column per subject, and one sheet per subject with No,
 * Nama Peserta Didik, NISN, and Nilai, whose values the school pastes into the template its own
 * Dapodik downloads for that class group and subject. A student whose report card is not locked
 * has empty values.
 */
export const ledgerWorkbook = (
  rows: readonly LedgerRow[]
): readonly (typeof Sheet.Type)[] => {
  const ordered = Arr.sort(
    rows,
    byName((row: LedgerRow) => row.name)
  );
  const subjects = namesOf(
    Arr.flatMap(ordered, (row) => Arr.map(row.subjects ?? [], subjectOf))
  );
  const legger: typeof Sheet.Type = {
    data: [
      ["No", "Nama Peserta Didik", "NISN", ...subjects],
      ...Arr.map(
        ordered,
        (row, index): SheetRow => [
          index + 1,
          row.name,
          row.nisn,
          ...Arr.map(subjects, (subject) => gradeOf(row, subject)),
        ]
      ),
    ],
    sheet: "Legger",
  };
  const perSubject = Arr.zipWith(
    subjects,
    sheetNames(subjects),
    (subject, sheet): typeof Sheet.Type => ({
      data: [
        ["No", "Nama Peserta Didik", "NISN", "Nilai"],
        ...Arr.map(
          ordered,
          (row, index): SheetRow => [
            index + 1,
            row.name,
            row.nisn,
            gradeOf(row, subject),
          ]
        ),
      ],
      sheet,
    })
  );
  return [legger, ...perSubject];
};

/** A class group's name as a file name takes it: letters and digits, joined by hyphens. */
export const fileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "");
