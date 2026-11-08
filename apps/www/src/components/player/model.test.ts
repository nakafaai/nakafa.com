import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  choiceAnswers,
  shortAnswers,
  textLabel,
} from "@repo/backend/confect/exams/blank";
import { Array as Arr } from "effect";
import { projectQuestions } from "@/components/player/model";

/** One single choice of three options, `option-1` to `option-3`. */
const [single] = choiceAnswers([
  textLabel("A"),
  textLabel("B"),
  textLabel("C"),
]);

/** One question of a binding: its key, its interactions, and whether it is answered and flagged. */
const question = (
  key: string,
  interactions: readonly Interaction[],
  marks: { readonly answered?: boolean; readonly flagged?: boolean } = {}
) => ({
  answered: marks.answered ?? false,
  flagged: marks.flagged ?? false,
  interactions,
  key,
});

/** The questions projected through saves the test reads back. */
function project(questions: readonly ReturnType<typeof question>[]) {
  const answer = vi.fn();
  const flag = vi.fn();
  const projected = projectQuestions({
    answer,
    cell: ({ answered, flagged, key }) => ({ answered, flagged, key }),
    flag,
    interactions: (item) => item.interactions,
    questions,
  });
  return { answer, flag, projected };
}

describe("projectQuestions", () => {
  it("marks each question as the binding reads it, in the binding's order, and flags it through the flag save", () => {
    const first = question("a", [single]);
    const second = question("b", [single], { answered: true, flagged: true });
    const { flag, projected } = project([first, second]);

    expect(
      Arr.map(projected, ({ answered, flagged, key }) => ({
        answered,
        flagged,
        key,
      }))
    ).toEqual([
      { answered: false, flagged: false, key: "a" },
      { answered: true, flagged: true, key: "b" },
    ]);
    projected[1]?.flag();
    expect(flag).toHaveBeenCalledExactlyOnceWith(second);
  });

  it("answers a digit with the one option at its index of a single choice, through the answer save", () => {
    const only = question("a", [single]);
    const { answer, projected } = project([only]);

    expect(projected[0]?.pick(1)).toBe(true);
    expect(answer).toHaveBeenCalledExactlyOnceWith(only, ["option-2"]);
  });

  it("picks nothing past the options, in a multiple choice, a written question, two choices, or none", () => {
    const { answer, projected } = project([
      question("outside", [single]),
      question("multiple", [{ ...single, maxChoices: 2 }]),
      question("written", shortAnswers()),
      question("two", [single, { ...single, id: "reason" }]),
      question("none", []),
    ]);
    const [outside, multiple, written, two, none] = projected;

    expect(outside?.pick(3)).toBe(false);
    expect(multiple?.pick(0)).toBe(false);
    expect(written?.pick(0)).toBe(false);
    expect(two?.pick(0)).toBe(false);
    expect(none?.pick(0)).toBe(false);
    expect(answer).not.toHaveBeenCalled();
  });
});
