import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  percentOf,
  practiceRowsOf,
  scoreOf,
  skillRowsOf,
  topicNameOf,
} from "@/components/tenant/insight/rows";

const student = Schema.decodeSync(Id("tenantPeople"))("person-1");

/** A student with nothing on record. */
const person = {
  draft: null,
  id: student,
  name: "",
  narrative: null,
  practice: [],
  skills: [],
};

describe("percentOf", () => {
  it("rounds a share to a whole percent", () => {
    expect(percentOf(0.586)).toBe(59);
    expect(percentOf(1)).toBe(100);
  });
});

describe("scoreOf", () => {
  it("rounds a mean score to a whole number", () => {
    expect(scoreOf(612.5)).toBe(613);
  });
});

describe("practiceRowsOf", () => {
  it("gives each shared topic its own row, named by its exam and track", () => {
    const topic = {
      countryKey: "indonesia",
      examKey: "snbt",
      mean: 700,
      sets: 2,
      trackKey: "2027",
    };
    expect(topicNameOf(topic)).toBe("snbt 2027");
    expect(
      practiceRowsOf([
        { ...person, name: "Raka", practice: [topic] },
        { ...person, name: "Nadia" },
      ])
    ).toEqual([{ ...topic, key: "person-1/snbt 2027", student: "Raka" }]);
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
        { ...person, name: "Raka", skills: [skill] },
        { ...person, name: "Nadia" },
      ])
    ).toEqual([{ ...skill, key: "person-1/Trigonometri", student: "Raka" }]);
  });
});
