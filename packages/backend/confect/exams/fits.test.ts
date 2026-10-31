import { describe, expect, it } from "@effect/vitest";
import {
  essayAnswers,
  newChoiceAnswers,
  numericAnswers,
} from "@repo/backend/confect/exams/blank";
import { answersFit } from "@repo/backend/confect/exams/fits";
import {
  reasonAnswers,
  reasonChoice,
} from "@repo/backend/confect/exams/reason";
import { Array as Arr } from "effect";

describe("exams/fits answersFit", () => {
  it("fits an essay's long text to the essay template, and no choice to it", () => {
    expect(answersFit("essay", essayAnswers())).toBe(true);
    expect(answersFit("essay", newChoiceAnswers())).toBe(false);
  });

  it("fits a numeric entry to the numeric template, and neither a choice nor an essay to it", () => {
    expect(answersFit("numeric", numericAnswers())).toBe(true);
    expect(answersFit("numeric", newChoiceAnswers())).toBe(false);
    expect(answersFit("numeric", essayAnswers())).toBe(false);
  });

  it("fits two choices to an answer and its reason alone, with no option named twice", () => {
    const reason = reasonChoice();

    expect(answersFit("reason", reasonAnswers())).toBe(true);
    expect(answersFit("reason", newChoiceAnswers())).toBe(false);
    expect(answersFit("choice", reasonAnswers())).toBe(false);
    expect(
      answersFit("reason", [
        ...newChoiceAnswers(),
        {
          ...reason,
          options: Arr.map(reason.options, (option, index) => ({
            ...option,
            id: `option-${index + 1}`,
          })),
        },
      ])
    ).toBe(false);
  });
});
