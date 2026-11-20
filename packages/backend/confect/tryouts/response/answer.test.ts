import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { QuestionResponse } from "@repo/backend/confect/assessment/parts";
import { earnedPoints } from "@repo/backend/confect/assessment/parts";
import {
  gradeAnswer,
  gradeQuestion,
} from "@repo/backend/confect/tryouts/response/answer";
import type { PlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { Result } from "effect";

/** A short answer, as an SNBT isian singkat sets it, which accepts two spellings. */
const SHORT: PlacedQuestion = {
  interactions: [
    {
      interaction: { id: "short", kind: "textEntry" },
      key: {
        accepted: {
          acceptedAnswers: ["Jakarta", "DKI Jakarta"],
          collapseWhitespace: true,
          ignoreCase: true,
          kind: "text",
        },
        interaction: "short",
        kind: "textEntry",
      },
      rule: { kind: "allOrNothing" },
    },
  ],
};

const numeric: Interaction = {
  acceptsFractions: false,
  id: "numeric",
  kind: "numericEntry",
  label: "Length",
  unit: "cm",
};

const numericKey: InteractionKey = {
  interaction: "numeric",
  kind: "numericEntry",
  value: "12.5",
};

/** A numeric answer in centimetres, as Penalaran Matematika sets it. */
const NUMERIC: PlacedQuestion = {
  interactions: [
    { interaction: numeric, key: numericKey, rule: { kind: "allOrNothing" } },
  ],
};

/** Points per part, as Aksara publishes the parts of a Feststellungsprüfung task. */
const points = (pointsPerPart: number) =>
  ({ floor: 0, kind: "perPart", pointsPerPart }) as const;

/**
 * A task of four parts, as Aksara publishes a Feststellungsprüfung item: a number worth 2 points, a word typed
 * exactly worth 1, an expression worth 3, and a written reason whose one criterion is worth 2.
 */
const PARTS: PlacedQuestion = {
  interactions: [
    {
      interaction: {
        acceptsFractions: false,
        id: "part-a",
        kind: "numericEntry",
      },
      key: { interaction: "part-a", kind: "numericEntry", value: "2" },
      rule: points(2),
    },
    {
      interaction: { id: "part-b", kind: "textEntry" },
      key: {
        accepted: {
          acceptedAnswers: ["Haus"],
          collapseWhitespace: true,
          ignoreCase: false,
          kind: "text",
        },
        interaction: "part-b",
        kind: "textEntry",
      },
      rule: points(1),
    },
    {
      interaction: { id: "part-c", kind: "mathEntry" },
      key: { expression: "x^2", interaction: "part-c", kind: "mathEntry" },
      rule: points(3),
    },
    {
      interaction: { id: "part-d", kind: "extendedText" },
      key: {
        criteria: [
          {
            criterion: "criterion-1",
            levels: [
              { descriptor: "Fehlt.", level: "missed" },
              { descriptor: "Begründet.", level: "met" },
            ],
          },
        ],
        interaction: "part-d",
        kind: "extendedText",
      },
      rule: {
        criteria: [
          {
            id: "criterion-1",
            label: "Begründung",
            levels: [
              { id: "missed", label: "Nicht erfüllt", points: 0 },
              { id: "met", label: "Erfüllt", points: 2 },
            ],
          },
        ],
        kind: "rubric",
      },
    },
  ],
};

/** The grade of a response, or the failure's code when the question refuses it. */
const gradeOf = (question: PlacedQuestion, response: QuestionResponse) =>
  Result.match(gradeAnswer(question, response), {
    onFailure: ({ code }) => code,
    onSuccess: ({ grade }) => grade,
  });

describe("tryouts/response/answer", () => {
  it("scores a short answer an accepted answer matches, and one that none matches as nothing, since no person grades a try-out", () => {
    expect(gradeOf(SHORT, { text: " dki  jakarta " })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(SHORT, { text: "Bandung" })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });

  it("scores a numeric answer by its number with either decimal point, and refuses a response that does not fit", () => {
    expect(gradeOf(NUMERIC, { text: "12,5" })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(NUMERIC, { text: "13" })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(NUMERIC, ["option-1"])).toBe("TRYOUT_RESPONSE_UNFIT");
  });

  it("scores each typed part all or nothing for its own points, a word only as written, and a blank part as nothing", () => {
    expect(
      gradeOf(PARTS, {
        parts: [
          { interaction: "part-b", response: { text: " Haus " } },
          { interaction: "part-a", response: { text: "2" } },
        ],
      })
    ).toEqual({
      category: 3,
      ceiling: 8,
      parts: [
        {
          grade: { category: 2, ceiling: 2, status: "scored" },
          interaction: "part-a",
        },
        {
          grade: { category: 1, ceiling: 1, status: "scored" },
          interaction: "part-b",
        },
        {
          grade: { category: 0, ceiling: 3, status: "scored" },
          interaction: "part-c",
        },
        {
          grade: { category: 0, ceiling: 2, status: "scored" },
          interaction: "part-d",
        },
      ],
      status: "scored",
    });
    expect(
      gradeOf(PARTS, {
        parts: [{ interaction: "part-b", response: { text: "haus" } }],
      })
    ).toMatchObject({ category: 0, ceiling: 8, status: "scored" });
  });

  it("scores an equivalent math expression and keeps a written answer pending, so the question earns its graded parts while it waits", () => {
    const grade = gradeOf(PARTS, {
      parts: [
        { interaction: "part-a", response: { text: "2" } },
        { interaction: "part-c", response: { text: "x \\cdot x" } },
        { interaction: "part-d", response: { text: "Weil x positiv ist." } },
      ],
    });
    expect(grade).toMatchObject({
      ceiling: 8,
      parts: [
        { grade: { category: 2, status: "scored" }, interaction: "part-a" },
        { grade: { category: 0, status: "scored" }, interaction: "part-b" },
        { grade: { category: 3, status: "scored" }, interaction: "part-c" },
        { grade: { ceiling: 2, status: "pending" }, interaction: "part-d" },
      ],
      status: "pending",
    });
    expect(
      earnedPoints(
        gradeQuestion(PARTS, {
          parts: [
            { interaction: "part-a", response: { text: "2" } },
            { interaction: "part-c", response: { text: "x \\cdot x" } },
            { interaction: "part-d", response: { text: "Weil." } },
          ],
        })
      )
    ).toBe(5);
  });

  it("refuses a question of several parts a response to one interaction, a part named twice or not its own, a part that does not fit, and a parts response to one interaction", () => {
    expect(gradeOf(PARTS, { text: "2" })).toBe("TRYOUT_RESPONSE_UNFIT");
    expect(
      gradeOf(PARTS, {
        parts: [
          { interaction: "part-a", response: { text: "2" } },
          { interaction: "part-a", response: { text: "3" } },
        ],
      })
    ).toBe("TRYOUT_RESPONSE_UNFIT");
    expect(
      gradeOf(PARTS, {
        parts: [{ interaction: "part-z", response: { text: "2" } }],
      })
    ).toBe("TRYOUT_RESPONSE_UNFIT");
    expect(
      gradeOf(PARTS, {
        parts: [{ interaction: "part-a", response: ["option-1"] }],
      })
    ).toBe("TRYOUT_RESPONSE_UNFIT");
    expect(
      gradeOf(NUMERIC, {
        parts: [{ interaction: "numeric", response: { text: "12,5" } }],
      })
    ).toBe("TRYOUT_RESPONSE_UNFIT");
  });

  it("grades an unanswered question of several parts as nothing out of every part's points", () => {
    expect(gradeQuestion(PARTS, [])).toMatchObject({
      category: 0,
      ceiling: 8,
      status: "scored",
    });
  });
});
