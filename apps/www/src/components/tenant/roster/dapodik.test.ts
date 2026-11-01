import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  type Cell,
  readDapodikSheet,
  sourcedOf,
  studentsOf,
} from "@/components/tenant/roster/dapodik";

/** A date cell, as the sheet reader gives a cell with a date format. */
const dateCell = (iso: string) => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

/**
 * A Dapodik export: title rows, the header, the sub-headers under the parents' column
 * groups, students, and a blank line below.
 */
const sheet: readonly (readonly Cell[])[] = [
  ["Daftar Peserta Didik"],
  ["SMP Harapan Bangsa", null],
  ["Tanggal Unduh: 2026-10-20"],
  [],
  [
    "No",
    "Nama",
    "NIPD",
    "JK",
    "NISN",
    "Tempat Lahir",
    "Tanggal Lahir",
    "NIK",
    "Data Ayah",
    null,
    "Rombel Saat Ini",
  ],
  [null, null, null, null, null, null, null, null, "Nama", "Pekerjaan", null],
  [
    1,
    "Raka Pratama",
    "1234",
    "L",
    "0012345678",
    "Bogor",
    "2012-05-21",
    "3201000000000001",
    "Agus",
    "Guru",
    "VII-A",
  ],
  [
    2,
    " Sari  Dewi ",
    "1235",
    "P",
    "0098765432",
    "Depok",
    dateCell("2008-01-10T00:00:00Z"),
    "3201000000000002",
    null,
    null,
    "",
  ],
  [
    3,
    "Budi",
    "1236",
    "L",
    "12345",
    "Bogor",
    "21/05/2012",
    "",
    null,
    null,
    "VII-A",
  ],
  [
    4,
    "",
    "1237",
    "L",
    "0011111111",
    "Bogor",
    "21-05-2012",
    "",
    null,
    null,
    "VII-B",
  ],
  [
    5,
    "Ani",
    "1238",
    "P",
    "0022222222",
    "Bogor",
    "kemarin",
    "",
    null,
    null,
    "VII-B",
  ],
  [
    6,
    "Dodi",
    "1239",
    "L",
    "0033333333",
    "Bogor",
    "21-05-2012",
    "",
    null,
    null,
    "x".repeat(41),
  ],
  [7, "Eka", "1240", "P", "0044444444", "Bogor", null, "", null, null, "VII-C"],
  [8, true, "1241", "L", "0055555555", "Bogor", null, "", null, null, ""],
  [
    9,
    "Fajar",
    "1242",
    "L",
    66_666_666,
    "Bogor",
    36_526,
    "",
    null,
    null,
    "VII-C",
  ],
  [
    10,
    "Gita",
    "1243",
    "P",
    "0077777777",
    "Bogor",
    "22 Agustus 2011",
    "",
    null,
    null,
    "VII-C",
  ],
  [
    11,
    "Hana",
    "1244",
    "P",
    "0088888888",
    "Bogor",
    "31/02/2012",
    "",
    null,
    null,
    "VII-C",
  ],
  [
    12,
    "Indra",
    "1245",
    "L",
    "0099999999",
    "Bogor",
    "22 Agustos 2011",
    "",
    null,
    null,
    "VII-C",
  ],
  [
    13,
    "Joko",
    "1246",
    "L",
    "0010101010",
    "Bogor",
    39_814.5,
    "",
    null,
    null,
    "VII-C",
  ],
  [
    14,
    "Kiki",
    "1247",
    "P",
    "0020202020",
    "Bogor",
    false,
    "",
    null,
    null,
    "VII-C",
  ],
  [null, "", null],
];

describe("readDapodikSheet", () => {
  it("finds the header below the title rows and reads only the name, NISN, and class group", () => {
    const read = readDapodikSheet(sheet);
    expect(read.outcome).toBe("read");
    const rows = read.outcome === "read" ? read.rows : [];
    const student = (
      line: number,
      name: string,
      nisn: string,
      cohortName?: string
    ) => ({
      line,
      outcome: "row",
      row: { ...(cohortName ? { cohortName } : {}), name, nisn },
    });
    expect(rows).toEqual([
      student(7, "Raka Pratama", "0012345678", "VII-A"),
      student(8, "Sari  Dewi", "0098765432"),
      { line: 9, outcome: "problem", problem: "nisn" },
      { line: 10, outcome: "problem", problem: "name" },
      student(11, "Ani", "0022222222", "VII-B"),
      { line: 12, outcome: "problem", problem: "cohort" },
      student(13, "Eka", "0044444444", "VII-C"),
      { line: 14, outcome: "problem", problem: "name" },
      student(15, "Fajar", "0066666666", "VII-C"),
      student(16, "Gita", "0077777777", "VII-C"),
      student(17, "Hana", "0088888888", "VII-C"),
      student(18, "Indra", "0099999999", "VII-C"),
      student(19, "Joko", "0010101010", "VII-C"),
      student(20, "Kiki", "0020202020", "VII-C"),
    ]);
    expect(studentsOf(rows)).toHaveLength(10);
  });

  it("refuses a sheet without the header, and one without a student below it", () => {
    expect(
      readDapodikSheet([
        ["Nama", "Kelas"],
        ["Raka", "VII"],
      ])
    ).toEqual({
      outcome: "refused",
      problem: "header",
    });
    expect(
      readDapodikSheet([
        ["NISN", "Nama"],
        [null, null],
      ])
    ).toEqual({
      outcome: "refused",
      problem: "empty",
    });
  });

  it("refuses a NISN that a number cell holds with a fraction", () => {
    const read = readDapodikSheet([
      ["Nama", "NISN"],
      ["Raka", 12_345.5],
    ]);
    expect(read).toEqual({
      outcome: "read",
      rows: [{ line: 2, outcome: "problem", problem: "nisn" }],
    });
  });
});

describe("sourcedOf", () => {
  it("keeps the students of a read OneRoster file, without the rows that have a problem", () => {
    expect(
      sourcedOf([
        {
          line: 2,
          outcome: "sourced",
          row: { name: "Raka Pratama", sourcedId: "u1" },
        },
        { line: 3, outcome: "problem", problem: "name" },
      ])
    ).toEqual([{ name: "Raka Pratama", sourcedId: "u1" }]);
  });
});
