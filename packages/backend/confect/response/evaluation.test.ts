import { describe, expect, it } from "@effect/vitest";
import {
  type DeliveryLanguage,
  DeliveryLanguageSchema,
} from "@nakafa/aksara-contracts/locale";
import type { QuestionAnswerKey } from "@nakafa/aksara-contracts/question/answer";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import type {
  Evaluated,
  ResponseRejected,
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { Array as Arr, Result } from "effect";

const indonesian = DeliveryLanguageSchema.make("id");
const german = DeliveryLanguageSchema.make("de");
const english = DeliveryLanguageSchema.make("en");
const label = { de: "Teil", en: "Part", id: "Bagian" };

const singleChoice = {
  kind: "single-choice",
  options: [
    { isCorrect: false, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: true, label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies ResponseSpec;

const multipleChoice = {
  kind: "multiple-choice",
  options: [
    { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: true, label: "B", optionKey: "option-2", order: 2 },
    { isCorrect: false, label: "C", optionKey: "option-3", order: 3 },
  ],
} satisfies ResponseSpec;

const category = {
  categories: [
    { categoryKey: "category-1", label: "True", order: 1 },
    { categoryKey: "category-2", label: "False", order: 2 },
  ],
  kind: "category",
  statements: [
    {
      correctCategoryKey: "category-1",
      label: "First",
      order: 1,
      statementKey: "statement-1",
    },
    {
      correctCategoryKey: "category-2",
      label: "Second",
      order: 2,
      statementKey: "statement-2",
    },
  ],
} satisfies ResponseSpec;

const half = {
  acceptsFractions: true,
  kind: "number",
  value: "0.5",
} satisfies QuestionAnswerKey;

const capital = {
  acceptedAnswers: ["Jakarta", "New York"],
  collapseWhitespace: true,
  ignoreCase: true,
  kind: "text",
} satisfies QuestionAnswerKey;

function shortAnswer(
  key: QuestionAnswerKey,
  language: DeliveryLanguage = indonesian
) {
  return { key, kind: "short-answer", language } satisfies ResponseSpec;
}

type Criterion = Extract<
  ResponseSpec,
  { readonly kind: "rubric" }
>["criteria"][number];

function level(order: number, points: number) {
  return { label, levelKey: `level-${order}`, order, points };
}

const judgedCriterion = {
  criterionKey: "criterion-1",
  label,
  levels: [level(1, 0), level(2, 1), level(3, 2)],
  order: 1,
} satisfies Criterion;
const cityCriterion = {
  criterionKey: "criterion-2",
  finalAnswer: { ...capital, acceptedAnswers: ["Paris"] },
  label,
  levels: [level(1, 0), level(2, 1)],
  order: 2,
} satisfies Criterion;
const numberCriterion = {
  criterionKey: "criterion-3",
  finalAnswer: { acceptsFractions: false, kind: "number", value: "4" },
  label,
  levels: [level(1, 0), level(2, 3)],
  order: 3,
} satisfies Criterion;
const rubric = {
  criteria: [judgedCriterion, cityCriterion, numberCriterion],
  kind: "rubric",
  language: indonesian,
} satisfies ResponseSpec;
const finalOnly = {
  ...rubric,
  criteria: [cityCriterion, numberCriterion],
} satisfies ResponseSpec;

/** Returns the evaluation, or the reason the selection was rejected. */
function settle(
  result: Result.Result<Evaluated, ResponseRejected>
): Evaluated | ResponseRejected["reason"] {
  return Result.match(result, {
    onFailure: ({ reason }) => reason,
    onSuccess: (evaluated) => evaluated,
  });
}

function typed(text: string): Selection {
  return { kind: "short-answer", text };
}

function finalAnswers(
  text: string,
  ...answers: readonly (readonly [string, string])[]
): Selection {
  return {
    finalAnswers: Arr.map(answers, ([criterionKey, answer]) => ({
      criterionKey,
      text: answer,
    })),
    kind: "rubric",
    text,
  };
}

describe("response/evaluation", () => {
  it("rejects a selection of another response kind for every kind", () => {
    const pairs: readonly (readonly [ResponseSpec, Selection])[] = [
      [singleChoice, typed("1")],
      [multipleChoice, typed("1")],
      [category, typed("1")],
      [shortAnswer(half), finalAnswers("Work")],
      [rubric, typed("1")],
    ];
    for (const [spec, selection] of pairs) {
      expect(settle(evaluate(spec, selection))).toBe("kind");
    }
  });

  it("rejects a selection that does not belong to its response", () => {
    expect(
      settle(
        evaluate(singleChoice, { kind: "single-choice", optionKey: "missing" })
      )
    ).toBe("selection");
    expect(settle(evaluate(shortAnswer(half), typed(" ")))).toBe("selection");
  });

  it("scores choice and category answers as correct or incorrect", () => {
    expect(
      settle(
        evaluate(singleChoice, { kind: "single-choice", optionKey: "option-2" })
      )
    ).toEqual({
      isComplete: true,
      outcome: { status: "correct" },
      selection: { kind: "single-choice", optionKey: "option-2" },
    });
    expect(
      settle(
        evaluate(singleChoice, { kind: "single-choice", optionKey: "option-1" })
      )
    ).toMatchObject({ outcome: { status: "incorrect" } });
    expect(
      settle(
        evaluate(multipleChoice, {
          kind: "multiple-choice",
          optionKeys: ["option-2", "option-1"],
        })
      )
    ).toEqual({
      isComplete: true,
      outcome: { status: "correct" },
      selection: {
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-2"],
      },
    });
    expect(
      settle(
        evaluate(multipleChoice, {
          kind: "multiple-choice",
          optionKeys: ["option-1"],
        })
      )
    ).toMatchObject({ outcome: { status: "incorrect" } });
    const assign = (first: string, second?: string) => ({
      assignments: [
        { categoryKey: first, statementKey: "statement-1" },
        ...(second === undefined
          ? []
          : [{ categoryKey: second, statementKey: "statement-2" }]),
      ],
      kind: "category" as const,
    });
    expect(
      settle(evaluate(category, assign("category-1", "category-2")))
    ).toMatchObject({ isComplete: true, outcome: { status: "correct" } });
    expect(
      settle(evaluate(category, assign("category-1", "category-1")))
    ).toMatchObject({ isComplete: true, outcome: { status: "incorrect" } });
    expect(settle(evaluate(category, assign("category-1")))).toMatchObject({
      isComplete: false,
      outcome: { status: "incorrect" },
    });
  });

  it("reads numbers with the delivery language's decimal separator", () => {
    expect(settle(evaluate(shortAnswer(half), typed(" 0,50 ")))).toEqual({
      isComplete: true,
      outcome: { status: "correct" },
      selection: { kind: "short-answer", number: "0.5", text: " 0,50 " },
    });
    expect(settle(evaluate(shortAnswer(half, german), typed("0,5")))).toEqual(
      expect.objectContaining({ outcome: { status: "correct" } })
    );
    expect(settle(evaluate(shortAnswer(half), typed("0.5")))).toEqual({
      isComplete: true,
      outcome: { status: "incorrect" },
      selection: { kind: "short-answer", text: "0.5" },
    });
    expect(settle(evaluate(shortAnswer(half, english), typed("0.5")))).toEqual(
      expect.objectContaining({ outcome: { status: "correct" } })
    );
    expect(settle(evaluate(shortAnswer(half, english), typed("−0.5")))).toEqual(
      {
        isComplete: true,
        outcome: { status: "incorrect" },
        selection: { kind: "short-answer", number: "-0.5", text: "−0.5" },
      }
    );
  });

  it("accepts fractions only when the key allows them", () => {
    expect(settle(evaluate(shortAnswer(half), typed("3 / 6")))).toEqual({
      isComplete: true,
      outcome: { status: "correct" },
      selection: { kind: "short-answer", number: "3/6", text: "3 / 6" },
    });
    expect(
      settle(
        evaluate(
          shortAnswer({ ...half, acceptsFractions: false }),
          typed("1/2")
        )
      )
    ).toEqual({
      isComplete: true,
      outcome: { status: "incorrect" },
      selection: { kind: "short-answer", number: "1/2", text: "1/2" },
    });
  });

  it("stores long readings as canonical decimals, never in exponent form", () => {
    const fractions = shortAnswer({ ...half, acceptsFractions: true }, english);

    expect(
      settle(evaluate(shortAnswer(half, english), typed("10000000000000000")))
    ).toMatchObject({ selection: { number: "10000000000000000" } });
    expect(
      settle(evaluate(shortAnswer(half), typed("-0,0000000000000001")))
    ).toMatchObject({ selection: { number: "-0.0000000000000001" } });
    expect(
      settle(evaluate(fractions, typed("5000000000000000/10000000000000000")))
    ).toMatchObject({
      outcome: { status: "correct" },
      selection: { number: "5000000000000000/10000000000000000" },
    });
  });

  it("grades absolute and relative tolerances inclusively", () => {
    const pi = shortAnswer({
      acceptsFractions: false,
      kind: "number",
      tolerance: { kind: "absolute", value: "0.01" },
      value: "3.14",
    });
    const hundred = shortAnswer(
      {
        acceptsFractions: false,
        kind: "number",
        tolerance: { kind: "relative", value: "0.05" },
        value: "100",
      },
      english
    );
    const status = (spec: ResponseSpec, text: string) => {
      const evaluated = settle(evaluate(spec, typed(text)));
      return typeof evaluated === "string"
        ? evaluated
        : evaluated.outcome.status;
    };

    expect(status(pi, "3,15")).toBe("correct");
    expect(status(pi, "3,16")).toBe("incorrect");
    expect(status(hundred, "105")).toBe("correct");
    expect(status(hundred, "106")).toBe("incorrect");
    expect(status(hundred, "1,000")).toBe("incorrect");
  });

  it("leaves unmatched text for the grader under the key's normalization flags", () => {
    const status = (key: QuestionAnswerKey, text: string) =>
      settle(evaluate(shortAnswer(key), typed(text)));

    expect(status(capital, "  jakarta ")).toEqual({
      isComplete: true,
      outcome: { status: "correct" },
      selection: { kind: "short-answer", text: "  jakarta " },
    });
    expect(status(capital, "new   york")).toMatchObject({
      outcome: { status: "correct" },
    });
    expect(status(capital, "Bandung")).toMatchObject({
      outcome: { status: "pending" },
    });
    expect(status({ ...capital, ignoreCase: false }, "jakarta")).toMatchObject({
      outcome: { status: "pending" },
    });
    expect(
      status({ ...capital, collapseWhitespace: false }, "New  York")
    ).toMatchObject({ outcome: { status: "pending" } });
  });

  it("treats an answer of invisible characters as blank", () => {
    expect(settle(evaluate(shortAnswer(capital), typed("\u200b")))).toBe(
      "selection"
    );
    expect(settle(evaluate(shortAnswer(half), typed("\u2060")))).toBe(
      "selection"
    );
    expect(
      settle(
        evaluate(
          rubric,
          finalAnswers(
            "\u200b\u2060",
            ["criterion-2", "Paris"],
            ["criterion-3", "4"]
          )
        )
      )
    ).toEqual({
      isComplete: false,
      outcome: { points: 4, status: "partial" },
      selection: {
        finalAnswers: [
          { criterionKey: "criterion-2", text: "Paris" },
          { criterionKey: "criterion-3", number: "4", text: "4" },
        ],
        kind: "rubric",
        text: "\u200b\u2060",
      },
    });
  });

  it("leaves a written rubric response pending and records typed readings", () => {
    expect(
      settle(
        evaluate(
          rubric,
          finalAnswers("Work", ["criterion-3", "4,0"], ["criterion-2", "paris"])
        )
      )
    ).toEqual({
      isComplete: true,
      outcome: { status: "pending" },
      selection: {
        finalAnswers: [
          { criterionKey: "criterion-2", text: "paris" },
          { criterionKey: "criterion-3", number: "4", text: "4,0" },
        ],
        kind: "rubric",
        text: "Work",
      },
    });
  });

  it("grades rubric final answers deterministically when nothing is judged", () => {
    expect(
      settle(
        evaluate(
          rubric,
          finalAnswers("", ["criterion-2", "Paris"], ["criterion-3", "4"])
        )
      )
    ).toMatchObject({
      isComplete: false,
      outcome: { points: 4, status: "partial" },
    });
    expect(
      settle(evaluate(rubric, finalAnswers("", ["criterion-3", "5"])))
    ).toMatchObject({ outcome: { status: "incorrect" } });
    expect(
      settle(
        evaluate(
          finalOnly,
          finalAnswers("", ["criterion-2", "Paris"], ["criterion-3", "4"])
        )
      )
    ).toMatchObject({ isComplete: true, outcome: { status: "correct" } });
    expect(
      settle(
        evaluate(
          finalOnly,
          finalAnswers("", ["criterion-2", "Rome"], ["criterion-3", "4"])
        )
      )
    ).toMatchObject({ outcome: { points: 3, status: "partial" } });
    expect(
      settle(evaluate(finalOnly, finalAnswers("", ["criterion-2", "Rome"])))
    ).toEqual({
      isComplete: false,
      outcome: { status: "incorrect" },
      selection: {
        finalAnswers: [{ criterionKey: "criterion-2", text: "Rome" }],
        kind: "rubric",
        text: "",
      },
    });
  });
});
