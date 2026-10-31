import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import {
  matchAnswers,
  newChoiceAnswers,
  type QuestionView,
  tableAnswers,
} from "@repo/backend/confect/exams/question";
import { scoreResponse } from "@repo/backend/confect/exams/results/score";
import {
  ALL_OR_NOTHING,
  scoringRule,
} from "@repo/backend/confect/exams/scoring";
import { Array as Arr } from "effect";

/** A single-answer choice with four options, as a new question starts. */
const single = newChoiceAnswers();

/** The same choice taking up to two options, as a multiple-choice question. */
const multiple = Arr.map(single, (interaction): Interaction =>
  interaction.kind === "choice"
    ? { ...interaction, maxChoices: 2 }
    : interaction
);

/** A text answer, which a person judges. */
const text: Interaction = { id: "text", kind: "textEntry", label: "Answer" };

/** The key of the choice `choice`, with the given options correct. A key names at least one correct option. */
const keyOf = (
  correct: readonly [string, ...string[]],
  interaction = "choice"
): InteractionKey[] => [{ correct, interaction, kind: "choice" }];

/** The key of the text entry `text`, accepting these texts in any case and spacing. */
const accepting = (
  ...acceptedAnswers: [string, ...string[]]
): InteractionKey[] => [
  {
    accepted: {
      acceptedAnswers,
      collapseWhitespace: true,
      ignoreCase: true,
      kind: "text",
    },
    interaction: "text",
    kind: "textEntry",
  },
];

/** The verdict of a question of one point, by the rule of a question no teacher set. */
const verdictOf = (
  answers: QuestionView["answers"],
  key: readonly InteractionKey[] | null,
  response: ExamResponse
) =>
  scoreResponse(
    { answers, key, points: 1, scoring: ALL_OR_NOTHING },
    response
  ).verdict;

/** A key that judges three statements of a table: true, false, and true. */
const tableKey: Arr.NonEmptyReadonlyArray<InteractionKey> = [
  {
    answers: [
      { column: "column-1", statement: "statement-1" },
      { column: "column-2", statement: "statement-2" },
      { column: "column-1", statement: "statement-3" },
    ],
    interaction: "matrix",
    kind: "matrix",
  },
];

/** A table's answer with these many of `tableKey`'s three statements marked against it. */
const cellsWithWrong = (wrong: number) => ({
  cells: [
    { column: wrong > 0 ? "column-2" : "column-1", statement: "statement-1" },
    { column: wrong > 1 ? "column-1" : "column-2", statement: "statement-2" },
    { column: wrong > 2 ? "column-2" : "column-1", statement: "statement-3" },
  ],
});

describe("exams/results/score", () => {
  it("scores a single-answer choice correct when its one option is the correct option", () => {
    expect(verdictOf(single, keyOf(["option-2"]), ["option-2"])).toBe(
      "correct"
    );
  });

  it("scores a single-answer choice incorrect when it chooses another option", () => {
    expect(verdictOf(single, keyOf(["option-2"]), ["option-1"])).toBe(
      "incorrect"
    );
  });

  it("scores an unanswered question incorrect, as the sitting closes it", () => {
    expect(verdictOf(single, keyOf(["option-2"]), [])).toBe("incorrect");
  });

  it("scores a multiple-choice question correct when its selection is exactly the correct options, in any order", () => {
    expect(
      verdictOf(multiple, keyOf(["option-1", "option-3"]), [
        "option-3",
        "option-1",
      ])
    ).toBe("correct");
  });

  it("scores a multiple-choice selection that misses a correct option or adds a wrong one incorrect", () => {
    const key = keyOf(["option-1", "option-3"]);
    expect(verdictOf(multiple, key, ["option-1"])).toBe("incorrect");
    expect(
      verdictOf(multiple, key, ["option-1", "option-3", "option-4"])
    ).toBe("incorrect");
  });

  it("scores a repeated option incorrect, even when it repeats a correct one", () => {
    expect(
      verdictOf(multiple, keyOf(["option-1", "option-3"]), [
        "option-1",
        "option-1",
      ])
    ).toBe("incorrect");
  });

  it("leaves a question pending when it has no key yet", () => {
    expect(verdictOf(single, null, ["option-2"])).toBe("pending");
  });

  it("leaves a question pending when its key holds no choice answer for its choice", () => {
    expect(
      verdictOf(single, keyOf(["option-2"], "another-choice"), ["option-2"])
    ).toBe("pending");
  });

  it("leaves a text answer pending when its key accepts no text for it", () => {
    expect(verdictOf([text], keyOf(["option-2"]), { text: "Paris" })).toBe(
      "pending"
    );
  });

  it("scores a short answer correct when it matches an accepted answer after normalization, whatever its case and spaces", () => {
    expect(
      verdictOf([text], accepting("Jakarta"), { text: "  jakarta " })
    ).toBe("correct");
    expect(
      verdictOf([text], accepting("Daerah Khusus", "DKI"), {
        text: "daerah   khusus",
      })
    ).toBe("correct");
  });

  it("leaves a short answer that matches no accepted answer pending, so the teacher judges it", () => {
    expect(
      verdictOf([text], accepting("Jakarta"), { text: "Batavia" })
    ).toBe("pending");
  });

  it("scores a blank short answer incorrect, as an unanswered question", () => {
    expect(verdictOf([text], accepting("Jakarta"), { text: "   " })).toBe(
      "incorrect"
    );
    expect(verdictOf([text], accepting("Jakarta"), [])).toBe("incorrect");
  });

  it("leaves a written essay pending for the teacher, and scores a blank one incorrect, with or without a key", () => {
    const essay: Interaction = {
      id: "essay",
      kind: "extendedText",
      label: "Answer",
    };
    expect(verdictOf([essay], null, { text: "Fotosintesis" })).toBe(
      "pending"
    );
    expect(verdictOf([essay], null, { text: "" })).toBe("incorrect");
    expect(verdictOf([essay], keyOf(["option-1"]), [])).toBe("incorrect");
  });

  it("scores a match correct when it makes exactly the key's pairs, and incorrect when it misses or changes one", () => {
    const [match] = matchAnswers();
    const key: InteractionKey[] = [
      {
        interaction: "match",
        kind: "match",
        pairs: [
          { source: "source-1", target: "target-2" },
          { source: "source-2", target: "target-1" },
          { source: "source-3", target: "target-3" },
        ],
      },
    ];
    const pairs = [
      { source: "source-2", target: "target-1" },
      { source: "source-1", target: "target-2" },
      { source: "source-3", target: "target-3" },
    ];
    expect(verdictOf([match], key, { pairs })).toBe("correct");
    expect(verdictOf([match], key, { pairs: Arr.take(pairs, 2) })).toBe(
      "incorrect"
    );
    expect(
      verdictOf([match], key, {
        pairs: [
          ...Arr.take(pairs, 2),
          { source: "source-3", target: "target-1" },
        ],
      })
    ).toBe("incorrect");
    expect(verdictOf([match], key, [])).toBe("incorrect");
    expect(verdictOf([match], keyOf(["option-1"]), { pairs })).toBe(
      "pending"
    );
  });

  it("scores a table correct when it marks every statement with the key's column, and incorrect otherwise", () => {
    const [table] = tableAnswers(["Benar", "Salah"]);
    const key: InteractionKey[] = [
      {
        answers: [
          { column: "column-1", statement: "statement-1" },
          { column: "column-2", statement: "statement-2" },
          { column: "column-1", statement: "statement-3" },
        ],
        interaction: "matrix",
        kind: "matrix",
      },
    ];
    const cells = [
      { column: "column-2", statement: "statement-2" },
      { column: "column-1", statement: "statement-1" },
      { column: "column-1", statement: "statement-3" },
    ];
    expect(verdictOf([table], key, { cells })).toBe("correct");
    expect(verdictOf([table], key, { cells: Arr.take(cells, 2) })).toBe(
      "incorrect"
    );
    expect(
      verdictOf([table], key, {
        cells: [
          ...Arr.take(cells, 2),
          { column: "column-2", statement: "statement-3" },
        ],
      })
    ).toBe("incorrect");
    expect(verdictOf([table], keyOf(["option-1"]), { cells })).toBe(
      "pending"
    );
  });

  it("scores a choice that a text response answers incorrect, as it chooses no option", () => {
    expect(verdictOf(single, keyOf(["option-2"]), { text: "B" })).toBe(
      "incorrect"
    );
  });

  it("leaves a question of two interactions pending, since a student answers one choice", () => {
    expect(
      verdictOf([...single, text], keyOf(["option-2"]), ["option-2"])
    ).toBe("pending");
  });

  it("scores a single-answer choice that names two options incorrect, as it names no one option", () => {
    expect(
      verdictOf(single, keyOf(["option-2"]), ["option-2", "option-3"])
    ).toBe("incorrect");
  });

  it("scores an unanswered multiple-choice question incorrect, as the sitting closes it", () => {
    expect(verdictOf(multiple, keyOf(["option-1", "option-3"]), [])).toBe(
      "incorrect"
    );
  });

  it("earns a whole question's points by default for a right answer, and none for any other", () => {
    const question = {
      answers: single,
      key: keyOf(["option-2"]),
      points: 10,
      scoring: ALL_OR_NOTHING,
    };
    expect(scoreResponse(question, ["option-2"])).toEqual({
      points: 10,
      verdict: "correct",
    });
    expect(scoreResponse(question, ["option-1"])).toEqual({
      points: 0,
      verdict: "incorrect",
    });
    expect(scoreResponse({ ...question, key: null }, ["option-1"])).toEqual({
      points: 0,
      verdict: "pending",
    });
  });

  it("scores a table by the AKM bands: all the points with no wrong statement, half with one or two, none with three", () => {
    const [table] = tableAnswers(["Benar", "Salah"]);
    const question = {
      answers: [table],
      key: tableKey,
      points: 4,
      scoring: scoringRule("wrongParts"),
    } satisfies Parameters<typeof scoreResponse>[0];
    const earned = Arr.map([0, 1, 2, 3], (wrong) =>
      scoreResponse(question, cellsWithWrong(wrong))
    );
    expect(earned).toEqual([
      { points: 4, verdict: "correct" },
      { points: 2, verdict: "partial" },
      { points: 2, verdict: "partial" },
      { points: 0, verdict: "incorrect" },
    ]);
  });

  it("shares a complex choice's points per part, and each wrong option takes a share back", () => {
    const question = {
      answers: multiple,
      key: keyOf(["option-1", "option-3"]),
      points: 4,
      scoring: scoringRule("perPart"),
    };
    expect(scoreResponse(question, ["option-1", "option-3"]).points).toBe(4);
    expect(scoreResponse(question, ["option-1"])).toEqual({
      points: 2,
      verdict: "partial",
    });
    expect(scoreResponse(question, ["option-1", "option-2"])).toEqual({
      points: 0,
      verdict: "incorrect",
    });
  });

  it("rounds a share down to whole points, so only a whole answer earns every point", () => {
    const [table] = tableAnswers(["Benar", "Salah"]);
    const question = {
      answers: [table],
      key: tableKey,
      points: 2,
      scoring: scoringRule("perPart"),
    } satisfies Parameters<typeof scoreResponse>[0];
    expect(scoreResponse(question, cellsWithWrong(1))).toEqual({
      points: 0,
      verdict: "incorrect",
    });
    expect(
      scoreResponse({ ...question, points: 4 }, cellsWithWrong(1))
    ).toEqual({ points: 1, verdict: "partial" });
  });
});
