import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  type Cell,
  isUnderAgeLimit,
  readDapodikSheet,
  studentsOf,
} from "@/components/tenant/roster/dapodik";

const TODAY = DateTime.makeUnsafe("2026-10-26T00:00:00Z");

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
  it("finds the header below the title rows and reads only the name, NISN, class group, and age", () => {
    const read = readDapodikSheet(sheet, TODAY);
    expect(read.outcome).toBe("read");
    const rows = read.outcome === "read" ? read.rows : [];
    expect(rows).toEqual([
      {
        line: 7,
        outcome: "row",
        row: {
          cohortName: "VII-A",
          name: "Raka Pratama",
          nisn: "0012345678",
          underAgeLimit: true,
        },
      },
      {
        line: 8,
        outcome: "row",
        row: { name: "Sari  Dewi", nisn: "0098765432", underAgeLimit: false },
      },
      { line: 9, outcome: "problem", problem: "nisn" },
      { line: 10, outcome: "problem", problem: "name" },
      { line: 11, outcome: "problem", problem: "birth" },
      { line: 12, outcome: "problem", problem: "cohort" },
      {
        line: 13,
        outcome: "row",
        row: {
          cohortName: "VII-C",
          name: "Eka",
          nisn: "0044444444",
          underAgeLimit: true,
        },
      },
      { line: 14, outcome: "problem", problem: "name" },
      {
        line: 15,
        outcome: "row",
        row: {
          cohortName: "VII-C",
          name: "Fajar",
          nisn: "0066666666",
          underAgeLimit: false,
        },
      },
      {
        line: 16,
        outcome: "row",
        row: {
          cohortName: "VII-C",
          name: "Gita",
          nisn: "0077777777",
          underAgeLimit: true,
        },
      },
      { line: 17, outcome: "problem", problem: "birth" },
      { line: 18, outcome: "problem", problem: "birth" },
      { line: 19, outcome: "problem", problem: "birth" },
      {
        line: 20,
        outcome: "row",
        row: {
          cohortName: "VII-C",
          name: "Kiki",
          nisn: "0020202020",
          underAgeLimit: true,
        },
      },
    ]);
    expect(studentsOf(rows)).toHaveLength(6);
  });

  it("reads the short birth date header of an older export", () => {
    const read = readDapodikSheet(
      [
        ["Nama", "NISN", "Tgl Lahir"],
        ["Raka", "0012345678", "01/01/2000"],
      ],
      TODAY
    );
    expect(read.outcome === "read" ? studentsOf(read.rows) : []).toEqual([
      { name: "Raka", nisn: "0012345678", underAgeLimit: false },
    ]);
  });

  it("refuses a sheet without the header, and one without a student below it", () => {
    expect(
      readDapodikSheet(
        [
          ["Nama", "Kelas"],
          ["Raka", "VII"],
        ],
        TODAY
      )
    ).toEqual({
      outcome: "refused",
      problem: "header",
    });
    expect(
      readDapodikSheet(
        [
          ["NISN", "Nama"],
          [null, null],
        ],
        TODAY
      )
    ).toEqual({
      outcome: "refused",
      problem: "empty",
    });
  });

  it("reads a sheet without a birth date column as under the limit", () => {
    const read = readDapodikSheet(
      [
        ["Nama", "NISN"],
        ["Raka", 12_345.5],
      ],
      TODAY
    );
    expect(read).toEqual({
      outcome: "read",
      rows: [{ line: 2, outcome: "problem", problem: "nisn" }],
    });
    const padded = readDapodikSheet(
      [
        ["Nama", "NISN"],
        ["Raka", "0012345678"],
      ],
      TODAY
    );
    expect(padded.outcome === "read" ? studentsOf(padded.rows) : []).toEqual([
      { name: "Raka", nisn: "0012345678", underAgeLimit: true },
    ]);
  });
});

describe("isUnderAgeLimit", () => {
  it("counts a student under the limit until the birthday of eighteen years", () => {
    const birth = DateTime.makeUnsafe("2008-10-27T00:00:00Z");
    expect(isUnderAgeLimit(birth, TODAY)).toBe(true);
    expect(
      isUnderAgeLimit(birth, DateTime.makeUnsafe("2026-10-27T00:00:00Z"))
    ).toBe(false);
  });
});
