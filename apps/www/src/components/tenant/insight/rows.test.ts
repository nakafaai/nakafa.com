import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { percentOf, skillRowsOf } from "@/components/tenant/insight/rows";

const student = Schema.decodeSync(Id("tenantPeople"))("person-1");

describe("percentOf", () => {
  it("rounds a share to a whole percent", () => {
    expect(percentOf(0.586)).toBe(59);
    expect(percentOf(1)).toBe(100);
  });
});

describe("skillRowsOf", () => {
  it("gives each student's competency its own row, and a student with none no row", () => {
    const skill = {
      chance: 0.6,
      competency: "Trigonometri",
      earned: 3,
      observations: 9,
      possible: 9,
      rating: 0.33,
    };
    expect(
      skillRowsOf([
        { id: student, name: "Raka", narrative: null, skills: [skill] },
        { id: student, name: "Nadia", narrative: null, skills: [] },
      ])
    ).toEqual([{ ...skill, key: "person-1/Trigonometri", student: "Raka" }]);
  });
});
