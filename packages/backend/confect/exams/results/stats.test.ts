import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  matchAnswers,
  newChoiceAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/question";
import {
  optionIdsOf,
  pairIdsOf,
  type ScoredAnswer,
  tallyAnswers,
} from "@repo/backend/confect/exams/results/stats";
import { Array as Arr } from "effect";

/** The option IDs of the choice that a new question holds, in order. */
const options = ["option-1", "option-2", "option-3", "option-4"];

describe("exams/results/stats", () => {
  it("lists the option IDs of the choices in their order, and none for another interaction", () => {
    const text: Interaction = {
      id: "text",
      kind: "textEntry",
      label: "Answer",
    };
    expect(optionIdsOf(newChoiceAnswers())).toEqual(options);
    expect(optionIdsOf([text])).toEqual([]);
  });

  it("lists the statements and the answers of a match in their order, and none for a choice", () => {
    expect(pairIdsOf(matchAnswers())).toEqual({
      sourceIds: ["source-1", "source-2", "source-3"],
      targetIds: ["target-1", "target-2", "target-3"],
    });
    expect(pairIdsOf(newChoiceAnswers())).toEqual({
      sourceIds: [],
      targetIds: [],
    });
  });

  it("lists the statements and the columns of a table in their order", () => {
    expect(pairIdsOf(tableAnswers(["Benar", "Salah"]))).toEqual({
      sourceIds: ["statement-1", "statement-2", "statement-3"],
      targetIds: ["column-1", "column-2"],
    });
  });

  it("tallies the answered count, the verdicts, and how many answers chose each option", () => {
    const answers: ScoredAnswer[] = [
      { response: ["option-1"], verdict: "correct" },
      { response: ["option-2"], verdict: "incorrect" },
      { response: ["option-2"], verdict: "incorrect" },
      { response: [], verdict: "incorrect" },
      { response: ["option-3", "option-4"], verdict: "pending" },
    ];
    expect(tallyAnswers(answers, options)).toEqual({
      answered: 4,
      correct: 1,
      incorrect: 3,
      optionCounts: [
        { count: 1, optionId: "option-1" },
        { count: 2, optionId: "option-2" },
        { count: 1, optionId: "option-3" },
        { count: 1, optionId: "option-4" },
      ],
      partial: 0,
      pending: 1,
    });
  });

  it("counts a typed answer as answered and a blank one as not, and neither chooses an option", () => {
    const answers: ScoredAnswer[] = [
      { response: { pairs: [] }, verdict: "incorrect" },
      { response: { text: "Jakarta" }, verdict: "correct" },
      { response: { text: "Batavia" }, verdict: "pending" },
      { response: { text: "  " }, verdict: "incorrect" },
    ];
    expect(tallyAnswers(answers, [])).toEqual({
      answered: 2,
      correct: 1,
      incorrect: 2,
      optionCounts: [],
      partial: 0,
      pending: 1,
    });
  });

  it("tallies an empty list of answers as nothing answered and every option at zero", () => {
    expect(tallyAnswers([], options)).toEqual({
      answered: 0,
      correct: 0,
      incorrect: 0,
      optionCounts: Arr.map(options, (optionId) => ({ count: 0, optionId })),
      partial: 0,
      pending: 0,
    });
  });
});
