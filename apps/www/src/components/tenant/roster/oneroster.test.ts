import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Struct } from "effect";
import {
  isBundleFile,
  parseCsv,
  readOneRoster,
} from "@/components/tenant/roster/oneroster";

const USERS = Arr.join(
  [
    "sourcedId,status,givenName,familyName,email",
    "u1,active,Raka,Pratama,raka@school.example",
    "u2,,Nadia,Putri,",
    "u3,tobedeleted,Bima,Santoso,",
    "t1,active,Ayu,Lestari,ayu@school.example",
    "u4,active,,,",
  ],
  "\n"
);

const CLASSES = Arr.join(
  [
    "sourcedId,status,title,classType",
    "c1,active,X-1,homeroom",
    "c2,active,Fisika X-1,scheduled",
    "c3,tobedeleted,X-2,homeroom",
  ],
  "\n"
);

const ENROLLMENTS = Arr.join(
  [
    "sourcedId,status,classSourcedId,userSourcedId,role",
    "e1,active,c1,u1,student",
    "e2,active,c2,u1,student",
    "e3,active,c2,u2,student",
    "e4,active,c1,t1,teacher",
    "e5,active,c1,u3,student",
    "e6,tobedeleted,c1,u2,student",
    "e7,active,c3,u4,student",
  ],
  "\n"
);

const BUNDLE = {
  "classes.csv": CLASSES,
  "enrollments.csv": ENROLLMENTS,
  "users.csv": USERS,
};

describe("parseCsv", () => {
  it("reads quoted fields with commas, line breaks and doubled quotes", () => {
    expect(parseCsv('a,"b,c"\r\n"d ""e""\nf",g\n')).toEqual([
      ["a", "b,c"],
      ['d "e"\nf', "g"],
    ]);
  });

  it("reads a last line that has no line break", () => {
    expect(parseCsv("a,b\nc,")).toEqual([
      ["a", "b"],
      ["c", ""],
    ]);
  });
});

describe("isBundleFile", () => {
  it("names the files the import reads, and no other", () => {
    expect(isBundleFile("users.csv")).toBe(true);
    expect(isBundleFile("demographics.csv")).toBe(false);
    expect(isBundleFile("nested/users.csv")).toBe(false);
  });
});

describe("readOneRoster", () => {
  it("reads the students by the source's identity, with their homeroom as the class group", () => {
    const read = readOneRoster(BUNDLE);

    expect(read).toEqual({
      outcome: "read",
      rows: [
        {
          line: 2,
          outcome: "sourced",
          row: { cohortName: "X-1", name: "Raka Pratama", sourcedId: "u1" },
        },
        {
          line: 3,
          outcome: "sourced",
          row: { name: "Nadia Putri", sourcedId: "u2" },
        },
        { line: 6, outcome: "problem", problem: "name" },
      ],
    });
  });

  it("takes a user's own role where a bundle has no enrollments, and a byte order mark", () => {
    const read = readOneRoster({
      "users.csv":
        "﻿sourcedId,role,givenName,familyName\nu1,student,Raka,Pratama\nu2,teacher,Ayu,Lestari",
    });

    expect(read).toMatchObject({
      outcome: "read",
      rows: [{ row: { sourcedId: "u1" } }],
    });
  });

  it("keeps out a student whose class group name is too long", () => {
    const read = readOneRoster(
      Struct.assign(BUNDLE, {
        "classes.csv": `sourcedId,title,classType\nc1,${"x".repeat(200)},homeroom`,
        "enrollments.csv":
          "sourcedId,classSourcedId,userSourcedId,role\ne1,c1,u1,student",
      })
    );

    expect(read).toMatchObject({
      outcome: "read",
      rows: [{ line: 2, outcome: "problem", problem: "cohort" }],
    });
  });

  it("keeps out a student whose identity is longer than the source may give", () => {
    const sourcedId = "u".repeat(300);
    const read = readOneRoster({
      "users.csv": `sourcedId,role,givenName,familyName\n${sourcedId},student,Raka,Pratama`,
    });

    expect(read).toMatchObject({
      outcome: "read",
      rows: [{ outcome: "problem", problem: "name" }],
    });
  });

  it("skips a user line that names no identity", () => {
    const read = readOneRoster({
      "users.csv":
        "sourcedId,role,givenName,familyName\n,student,Raka,Pratama\nu2,student,Nadia,Putri",
    });

    expect(read).toMatchObject({ outcome: "read" });
    expect(read.outcome === "read" ? Arr.length(read.rows) : 0).toBe(1);
  });

  it("refuses a file without the columns", () => {
    expect(readOneRoster({ "users.csv": "id,name\n1,Raka" })).toEqual({
      outcome: "refused",
      problem: "header",
    });
  });

  it("refuses a file without a student", () => {
    expect(
      readOneRoster({
        "users.csv": "sourcedId,role,givenName,familyName\nt1,teacher,Ayu,L",
      })
    ).toEqual({ outcome: "refused", problem: "empty" });
  });
});
