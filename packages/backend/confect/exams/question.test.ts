import { describe, expect, it } from "@effect/vitest";
import {
  answersFit,
  essayAnswers,
  keyMissing,
  needsKey,
  newChoiceAnswers,
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

describe("exams/question answersFit", () => {
  it("fits an essay's long text to the essay template, and no choice to it", () => {
    expect(answersFit("essay", essayAnswers())).toBe(true);
    expect(answersFit("essay", newChoiceAnswers())).toBe(false);
  });
});

describe("exams/question keyMissing", () => {
  const answers = newChoiceAnswers();
  const marked = [
    { correct: ["option-2"], interaction: "choice", kind: "choice" as const },
  ] as const;

  it("asks nothing of an essay, which the teacher scores without a key", () => {
    expect(
      keyMissing({ answers: essayAnswers(), key: null, template: "essay" })
    ).toBe(false);
  });

  it("holds back a choice with no key, and one whose key names no option of it", () => {
    expect(keyMissing({ answers, key: null, template: "choice" })).toBe(true);
    expect(
      keyMissing({
        answers,
        key: [{ correct: ["option-9"], interaction: "choice", kind: "choice" }],
        template: "choice",
      })
    ).toBe(true);
  });

  it("lets a choice through once its key marks one of its options", () => {
    expect(keyMissing({ answers, key: marked, template: "choice" })).toBe(
      false
    );
  });
});
