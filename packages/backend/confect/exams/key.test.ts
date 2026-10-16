import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/exams/key";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { Schema } from "effect";

/** A key that marks the given options of the choice `choice` correct. */
const choiceKey = (first: string, ...rest: string[]): InteractionKey => ({
  correct: [first, ...rest],
  interaction: "choice",
  kind: "choice",
});

describe("exams/key keyFits", () => {
  const [choice] = newChoiceAnswers();

  it("fits a key that marks one option of the choice correct", () => {
    expect(keyFits([choice], [choiceKey("option-2")])).toBe(true);
  });

  it("refuses a key that names an option the choice does not have", () => {
    expect(keyFits([choice], [choiceKey("option-9")])).toBe(false);
  });

  it("refuses two correct options for a choice that takes one", () => {
    expect(keyFits([choice], [choiceKey("option-1", "option-2")])).toBe(false);
  });

  it("fits two correct options for a choice that takes two", () => {
    const multiple = { ...choice, maxChoices: 2 };
    expect(keyFits([multiple], [choiceKey("option-1", "option-2")])).toBe(true);
  });

  it("refuses a question with no answer for one of its interactions", () => {
    expect(keyFits([choice], [])).toBe(false);
  });

  it("refuses an answer that names no interaction of the question", () => {
    expect(
      keyFits(
        [choice],
        [{ correct: ["option-1"], interaction: "other", kind: "choice" }]
      )
    ).toBe(false);
  });

  it("refuses an answer of another kind than its choice", () => {
    expect(
      keyFits(
        [choice],
        [{ correct: "option-1", interaction: "choice", kind: "inlineChoice" }]
      )
    ).toBe(false);
  });

  it("refuses an interaction that is not a choice, because a question takes only choices", () => {
    const text = Schema.decodeSync(InteractionSchema)({
      id: "text",
      kind: "textEntry",
      label: "Answer",
    });
    expect(
      keyFits(
        [text],
        [{ correct: ["option-1"], interaction: "text", kind: "choice" }]
      )
    ).toBe(false);
  });

  it("refuses interactions that share an identifier", () => {
    expect(
      keyFits([choice, choice], [choiceKey("option-1"), choiceKey("option-1")])
    ).toBe(false);
  });
});
