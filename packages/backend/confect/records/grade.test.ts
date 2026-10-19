import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { gradeView } from "@repo/backend/confect/records/grade";
import {
  DEFAULT_GRADING_SCHEME,
  type GradingScheme,
} from "@repo/backend/confect/records/scheme";
import { Schema } from "effect";

const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");
const gradeId = Schema.decodeUnknownSync(Id("classGrades"))("grade-1");

const scheme: GradingScheme = {
  bands: [
    { label: "Cukup", minimum: 60 },
    { label: "Baik", minimum: 80 },
  ],
  kktp: 75,
};

describe("records/grade view", () => {
  it("marks a value that reaches the KKTP as reached, with the band it reaches", () => {
    expect(
      gradeView(
        { _id: gradeId, classId, personId, state: "draft", value: 82 },
        scheme
      )
    ).toEqual({
      band: "Baik",
      classId,
      id: gradeId,
      kktp: "reached",
      personId,
      state: "draft",
      value: 82,
    });
  });

  it("marks a value below the KKTP as not reached, and leaves out a band it does not reach", () => {
    expect(
      gradeView(
        { _id: gradeId, classId, personId, state: "released", value: 50 },
        scheme
      )
    ).toEqual({
      classId,
      id: gradeId,
      kktp: "notReached",
      personId,
      state: "released",
      value: 50,
    });
  });

  it("judges by the built-in scheme, which has no band", () => {
    const view = gradeView(
      { _id: gradeId, classId, personId, state: "draft", value: 100 },
      DEFAULT_GRADING_SCHEME
    );
    expect(view).not.toHaveProperty("band");
    expect(view.kktp).toBe("reached");
  });
});
