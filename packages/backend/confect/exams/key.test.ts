import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/exams/key";
import {
  essayAnswers,
  matchAnswers,
  newChoiceAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/question";
import type {
  ExamCell,
  ExamPair,
} from "@repo/backend/confect/exams/sittings/response";
import { type Array as Arr, Schema } from "effect";

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

  it("fits a text interaction with accepted answers, and refuses a choice answer for it", () => {
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
    expect(
      keyFits(
        [text],
        [
          {
            accepted: {
              acceptedAnswers: ["Jakarta"],
              collapseWhitespace: true,
              ignoreCase: true,
              kind: "text",
            },
            interaction: "text",
            kind: "textEntry",
          },
        ]
      )
    ).toBe(true);
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

  it("fits a match key that pairs every statement once, and refuses one that leaves a statement or pairs an answer twice", () => {
    const pairs = [
      { source: "source-1", target: "target-3" },
      { source: "source-2", target: "target-1" },
      { source: "source-3", target: "target-2" },
    ] as const;
    const keyOf = (
      made: Arr.NonEmptyReadonlyArray<ExamPair>
    ): InteractionKey => ({
      interaction: "match",
      kind: "match",
      pairs: made,
    });
    expect(keyFits(matchAnswers(), [keyOf(pairs)])).toBe(true);
    expect(keyFits(matchAnswers(), [keyOf([pairs[0], pairs[1]])])).toBe(false);
    expect(
      keyFits(matchAnswers(), [
        keyOf([pairs[0], pairs[1], { source: "source-3", target: "target-3" }]),
      ])
    ).toBe(false);
  });

  it("fits a table key that marks every statement, and refuses one that leaves a statement blank", () => {
    const cells = [
      { column: "column-1", statement: "statement-1" },
      { column: "column-2", statement: "statement-2" },
      { column: "column-2", statement: "statement-3" },
    ] as const;
    const keyOf = (
      marked: Arr.NonEmptyReadonlyArray<ExamCell>
    ): InteractionKey => ({
      answers: marked,
      interaction: "matrix",
      kind: "matrix",
    });
    const table = tableAnswers(["Benar", "Salah"]);
    expect(keyFits(table, [keyOf(cells)])).toBe(true);
    expect(keyFits(table, [keyOf([cells[0], cells[1]])])).toBe(false);
  });

  it("refuses any key for an essay, which its rubric scores", () => {
    expect(
      keyFits(essayAnswers(), [
        { correct: ["option-1"], interaction: "essay", kind: "choice" },
      ])
    ).toBe(false);
  });
});
