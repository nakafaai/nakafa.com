import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  matchAnswers,
  newChoiceAnswers,
  shortAnswers,
  tableAnswers,
  textLabel,
} from "@repo/backend/confect/exams/question";
import { asTemplate } from "@repo/backend/confect/exams/template";

/** An empty document, as an option or a statement holds one. */
const empty = { content: [{ type: "paragraph" }], type: "doc" } as const;

/** A true or false statement table, an interaction that is not a choice. */
const matrix: Interaction = {
  columns: [
    { id: "true", label: empty },
    { id: "false", label: empty },
  ],
  id: "matrix",
  kind: "matrix",
  label: "Statements",
  shuffle: false,
  statements: [{ id: "statement-1", label: empty }],
};

describe("exams/template asTemplate", () => {
  it("gives each choice the template's bounds, and leaves an interaction that is no choice as it is", () => {
    const [choice] = newChoiceAnswers();
    const converted = asTemplate("choices", [choice, matrix], null, []);
    expect(converted.answers).toEqual([
      { ...choice, maxChoices: 4, minChoices: 1 },
      matrix,
    ]);
    expect(converted.key).toBeNull();
  });

  it("keeps a key that fits the new bounds and clears one that does not", () => {
    const answers = asTemplate("choices", newChoiceAnswers(), null, []).answers;
    const several = [
      {
        correct: ["option-1", "option-2"],
        interaction: "choice",
        kind: "choice",
      },
    ] as const;
    expect(asTemplate("choices", answers, several, []).key).toEqual(several);
    expect(asTemplate("choice", answers, several, []).key).toBeNull();
  });

  it("gives each choice the options a template fixes, labelled in order, and clears the key", () => {
    const [choice] = newChoiceAnswers();
    const key = [
      { correct: ["option-1"], interaction: "choice", kind: "choice" },
    ] as const;
    const converted = asTemplate("truefalse", [choice, matrix], key, [
      "Benar",
      "Salah",
    ]);
    expect(converted.answers).toEqual([
      {
        ...choice,
        maxChoices: 1,
        minChoices: 1,
        options: [
          { id: "option-1", label: textLabel("Benar") },
          { id: "option-2", label: textLabel("Salah") },
        ],
      },
      matrix,
    ]);
    expect(converted.key).toBeNull();
  });

  it("turns any question into one text entry with no key, and a short answer back into a new choice", () => {
    const key = [
      { correct: ["option-1"], interaction: "choice", kind: "choice" },
    ] as const;
    const short = asTemplate("short", newChoiceAnswers(), key, []);
    expect(short).toEqual({ answers: shortAnswers(), key: null });
    expect(asTemplate("choice", short.answers, null, [])).toEqual({
      answers: newChoiceAnswers(),
      key: null,
    });
  });

  it("turns any question into one match of empty statements and answers with no key", () => {
    expect(asTemplate("match", newChoiceAnswers(), null, [])).toEqual({
      answers: matchAnswers(),
      key: null,
    });
  });

  it("turns any question into a table of empty statements and the two columns it is given, with no key", () => {
    expect(
      asTemplate("table", newChoiceAnswers(), null, ["Benar", "Salah"])
    ).toEqual({ answers: tableAnswers(["Benar", "Salah"]), key: null });
  });
});
