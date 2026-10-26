import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Id } from "@repo/backend/confect/_generated/id";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Schema } from "effect";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import {
  projectSittingCells,
  projectSittingQuestions,
} from "@/components/exams/sitting/questions";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

/** The choice that the exam editor starts a question with, which the tests give another maximum. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;
const starter = Option.getOrThrow(
  Arr.findFirst(
    newChoiceAnswers(),
    (interaction): interaction is Choice => interaction.kind === "choice"
  )
);

/** A choice of the given maximum, with the options of the starter choice. */
const choice = (maxChoices: number): Interaction => ({
  ...starter,
  maxChoices,
});

/** One question of the paper, with its interactions, its response, and its flag. */
function question(
  id: string,
  interactions: PaperQuestion["interactions"],
  fields: Partial<PaperQuestion> = {}
): PaperQuestion {
  return {
    flagged: false,
    id: questionId(id),
    interactions,
    number: 1,
    response: null,
    version: null,
    ...fields,
  };
}

describe("projectSittingCells", () => {
  it("marks each question of the paper by its response and its flag, in the paper's order", () => {
    expect(
      projectSittingCells({
        questions: [
          question("q-empty", [choice(1)]),
          question("q-chosen", [choice(1)], {
            flagged: true,
            response: ["b"],
            version: 2,
          }),
          question("q-cleared", [choice(1)], { response: [] }),
          question("q-typed", [choice(1)], { response: { text: "Jakarta" } }),
          question("q-blank", [choice(1)], { response: { text: " " } }),
        ],
      })
    ).toEqual([
      { answered: false, flagged: false, key: "q-empty" },
      { answered: true, flagged: true, key: "q-chosen" },
      { answered: false, flagged: false, key: "q-cleared" },
      { answered: true, flagged: false, key: "q-typed" },
      { answered: false, flagged: false, key: "q-blank" },
    ]);
  });
});

describe("projectSittingQuestions", () => {
  it("marks each question by its response and its flag, and flags it through the flag save", () => {
    const paper: PaperValue = {
      questions: [
        question("q-empty", [choice(1)]),
        question("q-chosen", [choice(1)], {
          flagged: true,
          response: ["b"],
          version: 2,
        }),
        question("q-cleared", [choice(1)], { response: [] }),
        question("q-typed", [choice(1)], { response: { text: "Jakarta" } }),
        question("q-blank", [choice(1)], { response: { text: " " } }),
      ],
    };
    const flag = vi.fn();
    const [empty, chosen, cleared, typed, blank] = projectSittingQuestions({
      choose: vi.fn(),
      flag,
      paper,
    });

    expect(empty).toMatchObject({
      answered: false,
      flagged: false,
      key: "q-empty",
    });
    expect(chosen).toMatchObject({
      answered: true,
      flagged: true,
      key: "q-chosen",
    });
    expect(cleared).toMatchObject({ answered: false });
    expect(typed).toMatchObject({ answered: true });
    expect(blank).toMatchObject({ answered: false });

    chosen?.flag();
    expect(flag).toHaveBeenCalledExactlyOnceWith(paper.questions[1]);
  });

  it("picks the option at the digit's index of a single choice, and saves it at once", () => {
    const choose = vi.fn();
    const single = question("q-single", [choice(1)]);
    const [model] = projectSittingQuestions({
      choose,
      flag: vi.fn(),
      paper: { questions: [single] },
    });

    expect(model?.pick(1)).toBe(true);

    const [, second] = starter.options;
    expect(choose).toHaveBeenCalledWith(single, [second?.id]);
  });

  it("picks nothing where the digit names no option, or the question takes no single choice", () => {
    const choose = vi.fn();
    const [outside, multiple, text] = projectSittingQuestions({
      choose,
      flag: vi.fn(),
      paper: {
        questions: [
          question("q-outside", [choice(1)]),
          question("q-multiple", [choice(2)]),
          question("q-text", [
            { id: "entry", kind: "textEntry", label: "Answer" },
          ]),
        ],
      },
    });

    expect(outside?.pick(9)).toBe(false);
    expect(multiple?.pick(0)).toBe(false);
    expect(text?.pick(0)).toBe(false);
    expect(choose).not.toHaveBeenCalled();
  });
});
