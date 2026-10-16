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

/** An option whose label is one empty paragraph, as the options of a new question are. */
const emptyOption = (id: string) => ({
  id,
  label: { content: [{ type: "paragraph" }], type: "doc" },
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

  it("refuses an interaction that no answer names", () => {
    expect(
      keyFits(
        [choice],
        [{ correct: ["option-1"], interaction: "other", kind: "choice" }]
      )
    ).toBe(false);
  });

  it("refuses an extra answer that names no interaction, beside the answer of each interaction", () => {
    expect(
      keyFits(
        [choice],
        [
          choiceKey("option-1"),
          { correct: ["option-1"], interaction: "other", kind: "choice" },
        ]
      )
    ).toBe(false);
  });

  it("refuses an answer of another kind than its choice, though its text would fit the choice", () => {
    // A one-letter option lets the inline answer's text pass the count check, so only its kind refuses it.
    const letters = Schema.decodeSync(InteractionSchema)({
      id: "choice",
      kind: "choice",
      label: "Answer",
      maxChoices: 1,
      minChoices: 1,
      options: [emptyOption("a"), emptyOption("b")],
      shuffle: false,
    });
    expect(
      keyFits(
        [letters],
        [{ correct: "a", interaction: "choice", kind: "inlineChoice" }]
      )
    ).toBe(false);
  });

  it("refuses a text interaction, which no choice answer fits", () => {
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

  it("refuses interactions that share an identifier, even when the key answers that identifier once", () => {
    expect(
      keyFits(
        [choice, { ...choice }],
        [
          choiceKey("option-1"),
          { correct: ["option-2"], interaction: "other", kind: "choice" },
        ]
      )
    ).toBe(false);
  });
});
