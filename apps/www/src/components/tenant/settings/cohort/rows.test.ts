import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { cohortRows } from "@/components/tenant/settings/cohort/rows";

const cohortId = Schema.decodeUnknownSync(Id("tenantCohorts"));
const first = cohortId("x-1");
const second = cohortId("x-2");
const COHORTS = [
  { grade: 10, id: first, name: "X-1", status: "active" as const },
  { grade: 10, id: second, name: "X-2", status: "active" as const },
];

describe("cohortRows", () => {
  it("joins each cohort with its homeroom teacher and counts once the overview is read", () => {
    expect(
      cohortRows(COHORTS, [
        {
          classes: 3,
          hold: null,
          homeroom: "Bu Sari",
          id: first,
          name: "X-1",
          students: 32,
        },
        {
          classes: 0,
          hold: null,
          homeroom: null,
          id: second,
          name: "X-2",
          students: 0,
        },
      ])
    ).toEqual([
      { ...COHORTS[0], classes: 3, homeroom: "Bu Sari", students: 32 },
      { ...COHORTS[1], classes: 0, homeroom: "", students: 0 },
    ]);
  });

  it("names no homeroom teacher and no counts before the overview arrives", () => {
    expect(cohortRows(COHORTS, null)).toEqual([
      { ...COHORTS[0], classes: null, homeroom: "", students: null },
      { ...COHORTS[1], classes: null, homeroom: "", students: null },
    ]);
  });
});
