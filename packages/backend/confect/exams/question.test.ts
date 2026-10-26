import { describe, expect, it } from "@effect/vitest";
import {
  needsKey,
  QuestionTemplate,
  takesRubric,
} from "@repo/backend/confect/exams/question";
import { Array as Arr } from "effect";

describe("exams/question takesRubric and needsKey", () => {
  it("gives a rubric to the essay alone, which the teacher scores, and a key to every other template", () => {
    expect(
      Arr.filter(QuestionTemplate.literals, (template) => takesRubric(template))
    ).toEqual(["essay"]);
    expect(
      Arr.filter(QuestionTemplate.literals, (template) => !needsKey(template))
    ).toEqual(["essay"]);
  });
});
