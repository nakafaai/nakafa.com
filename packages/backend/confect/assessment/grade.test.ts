import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ScoringRule } from "@nakafa/aksara-contracts/assessment/scoring";
import { grade } from "@repo/backend/confect/assessment/grade";
import type {
  ExamPair,
  ExamResponse,
} from "@repo/backend/confect/assessment/response";
import {
  matchAnswers,
  newChoiceAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/blank";
import { Array as Arr } from "effect";

const ALL_OR_NOTHING: ScoringRule = { kind: "allOrNothing" };

/** A choice of four options taking up to four, as a multiple-choice question. */
const choice: Interaction = Arr.map(newChoiceAnswers(), (interaction) =>
  interaction.kind === "choice"
    ? { ...interaction, maxChoices: interaction.options.length }
    : interaction
)[0];

/** A true or false table of the statements School's builder starts with. */
const [table] = tableAnswers(["True", "False"]);

/** A match of School's builder. */
const [match] = matchAnswers();

const text: Interaction = { id: "text", kind: "textEntry", label: "Answer" };
const essay: Interaction = {
  id: "essay",
  kind: "extendedText",
  label: "Essay",
};
const numeric: Interaction = {
  acceptsFractions: false,
  id: "numeric",
  kind: "numericEntry",
  label: "Number",
};

const choiceKey: InteractionKey = {
  correct: ["option-1", "option-3"],
  interaction: "choice",
  kind: "choice",
};

/** Each statement of the table in its column, alternating True and False. */
const tableCells = Arr.map(table.statements, (statement, index) => ({
  column: index % 2 === 0 ? "column-1" : "column-2",
  statement: statement.id,
}));

const tableKey: InteractionKey = {
  answers: tableCells,
  interaction: table.id,
  kind: "matrix",
};

const matchPairs: readonly [ExamPair, ExamPair] = [
  { source: "source-1", target: "target-1" },
  { source: "source-2", target: "target-2" },
];

const matchKey: InteractionKey = {
  interaction: match.id,
  kind: "match",
  pairs: [...matchPairs],
};

const textKey: InteractionKey = {
  accepted: {
    acceptedAnswers: ["Jakarta"],
    collapseWhitespace: true,
    ignoreCase: true,
    kind: "text",
  },
  interaction: "text",
  kind: "textEntry",
};

/** Grades a response under the rule, all or nothing unless given. */
const gradeOf = (
  interaction: Interaction,
  key: InteractionKey | undefined,
  response: ExamResponse,
  rule: ScoringRule = ALL_OR_NOTHING
) => grade({ interaction, key, response, rule });

describe("assessment/grade", () => {
  it("scores a choice all or nothing: every correct option and no other", () => {
    expect(gradeOf(choice, choiceKey, ["option-3", "option-1"])).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(choice, choiceKey, ["option-1"])).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
    expect(
      gradeOf(choice, choiceKey, ["option-1", "option-3", "option-4"])
    ).toEqual({ category: 0, ceiling: 1, status: "scored" });
  });

  it("scores an unanswered interaction 0 under every rule, with the rule's ceiling", () => {
    expect(
      gradeOf(choice, choiceKey, [], {
        floor: 0,
        kind: "perPart",
        pointsPerPart: 2,
      })
    ).toEqual({ category: 0, ceiling: 4, status: "scored" });
    expect(gradeOf(essay, undefined, { text: "  " })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });

  it("scores a table by its statements, every one in its column", () => {
    expect(gradeOf(table, tableKey, { cells: tableCells })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    const flipped = Arr.map(tableCells, (cell, index) =>
      index === 0 ? { ...cell, column: "column-2" } : cell
    );
    expect(gradeOf(table, tableKey, { cells: flipped })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });

  it("scores a match by its pairs, exactly the key's", () => {
    expect(gradeOf(match, matchKey, { pairs: [...matchPairs] })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(match, matchKey, { pairs: [matchPairs[0]] })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });

  it("earns points per correct part, loses the penalty per extra value, and stays between the floor and the ceiling", () => {
    const perPart: ScoringRule = {
      floor: 1,
      kind: "perPart",
      penaltyPerWrongPart: 2,
      pointsPerPart: 3,
    };
    expect(gradeOf(choice, choiceKey, ["option-1"], perPart)).toEqual({
      category: 3,
      ceiling: 6,
      status: "scored",
    });
    expect(
      gradeOf(choice, choiceKey, ["option-1", "option-3"], perPart)
    ).toEqual({ category: 6, ceiling: 6, status: "scored" });
    expect(
      gradeOf(choice, choiceKey, ["option-2", "option-4"], perPart)
    ).toEqual({ category: 1, ceiling: 6, status: "scored" });
    expect(
      gradeOf(choice, choiceKey, ["option-1", "option-3"], {
        floor: 0,
        kind: "perPart",
        pointsPerPart: 1,
      })
    ).toEqual({ category: 2, ceiling: 2, status: "scored" });
  });

  it("takes the points of the first wrong-parts band that holds the missed and extra parts", () => {
    const bands: ScoringRule = {
      bands: [
        { points: 2, wrong: 0 },
        { points: 1, wrong: 2 },
      ],
      kind: "wrongParts",
    };
    expect(gradeOf(choice, choiceKey, ["option-1", "option-3"], bands)).toEqual(
      { category: 2, ceiling: 2, status: "scored" }
    );
    expect(gradeOf(choice, choiceKey, ["option-1"], bands)).toEqual({
      category: 1,
      ceiling: 2,
      status: "scored",
    });
    expect(gradeOf(choice, choiceKey, ["option-2", "option-4"], bands)).toEqual(
      { category: 0, ceiling: 2, status: "scored" }
    );
  });

  it("counts a statement or a pair with another answer as one wrong part, and an option missed and an option added as two", () => {
    const bands: ScoringRule = {
      bands: [
        { points: 2, wrong: 0 },
        { points: 1, wrong: 1 },
      ],
      kind: "wrongParts",
    };
    const swapped = gradeOf(choice, choiceKey, ["option-1", "option-2"], bands);
    expect(swapped).toEqual({ category: 0, ceiling: 2, status: "scored" });
    const anotherColumn = Arr.map(tableCells, (cell, index) =>
      index === 0 ? { ...cell, column: "column-2" } : cell
    );
    expect(gradeOf(table, tableKey, { cells: anotherColumn }, bands)).toEqual({
      category: 1,
      ceiling: 2,
      status: "scored",
    });
    const anotherAnswer = Arr.map(matchPairs, (pair, index) =>
      index === 0 ? { ...pair, target: "target-9" } : pair
    );
    expect(gradeOf(match, matchKey, { pairs: anotherAnswer }, bands)).toEqual({
      category: 1,
      ceiling: 2,
      status: "scored",
    });
  });

  it("leaves a rubric to a person", () => {
    expect(
      gradeOf(choice, choiceKey, ["option-1"], {
        criteria: [
          {
            id: "work",
            label: "Work",
            levels: [
              { id: "none", label: "None", points: 0 },
              { id: "full", label: "Full", points: 2 },
            ],
          },
        ],
        kind: "rubric",
      })
    ).toEqual({ ceiling: 2, status: "pending" });
  });

  it("scores a typed answer that an accepted answer matches, and leaves any other typed answer to a person", () => {
    expect(gradeOf(text, textKey, { text: "  jakarta " })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(text, textKey, { text: "Bandung" })).toEqual({
      ceiling: 1,
      status: "pending",
    });
    expect(gradeOf(text, textKey, ["option-1"])).toEqual({
      ceiling: 1,
      status: "pending",
    });
  });

  it("leaves a written text, an interaction without its key, and a kind it does not read to a person", () => {
    expect(gradeOf(essay, undefined, { text: "An essay." })).toEqual({
      ceiling: 1,
      status: "pending",
    });
    // An essay's key holds criteria, which a teacher reads: the grader scores none of them.
    expect(
      gradeOf(
        essay,
        {
          criteria: [
            {
              criterion: "steps",
              levels: [{ descriptor: "Lengkap", level: "complete" }],
            },
          ],
          interaction: "essay",
          kind: "extendedText",
        },
        { text: "An essay." }
      )
    ).toEqual({ ceiling: 1, status: "pending" });
    expect(gradeOf(choice, undefined, ["option-1"])).toEqual({
      ceiling: 1,
      status: "pending",
    });
    expect(
      gradeOf(choice, { ...choiceKey, interaction: "other" }, ["option-1"])
    ).toEqual({ ceiling: 1, status: "pending" });
  });

  it("scores a typed number its key holds, in any script and with either decimal point, and any other number 0", () => {
    const half: InteractionKey = {
      interaction: "numeric",
      kind: "numericEntry",
      tolerance: { kind: "absolute", value: "0.01" },
      value: "0.5",
    };
    for (const typed of ["0.5", "0,5", "٠٫٥", "0.51"]) {
      expect(gradeOf(numeric, half, { text: typed })).toEqual({
        category: 1,
        ceiling: 1,
        status: "scored",
      });
    }
    for (const typed of ["0.52", "1/2", "setengah"]) {
      expect(gradeOf(numeric, half, { text: typed })).toEqual({
        category: 0,
        ceiling: 1,
        status: "scored",
      });
    }
    // A numeric key is right or wrong, so no answer it reads waits for a person, an answer of another shape included.
    expect(gradeOf(numeric, half, ["option-1"])).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });
});
