import { describe, expect, it } from "@effect/vitest";
import {
  QuestionTemplate,
  takesRubric,
} from "@repo/backend/confect/exams/question";
import { Array as Arr } from "effect";

describe("exams/question takesRubric", () => {
  it("gives no choice template a rubric, since the key scores a choice", () => {
    expect(Arr.map(QuestionTemplate.literals, takesRubric)).toEqual(
      Arr.map(QuestionTemplate.literals, () => false)
    );
  });
});
