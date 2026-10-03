import { describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import type {
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import {
  freeze,
  project,
  projectSelection,
} from "@repo/backend/confect/response/projection";
import { Array as Arr } from "effect";

const indonesian = DeliveryLanguageSchema.make("id");
const label = { de: "Ergebnis", en: "Result", id: "Hasil" };

const singleChoice = {
  kind: "single-choice",
  options: [
    { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies ResponseSpec;

const category = {
  categories: [{ categoryKey: "category-1", label: "Yes", order: 1 }],
  kind: "category",
  statements: [
    {
      correctCategoryKey: "category-1",
      label: "Statement",
      order: 1,
      statementKey: "statement-1",
    },
  ],
} satisfies ResponseSpec;

const shortAnswer = {
  key: { acceptsFractions: true, kind: "number", value: "0.5" },
  kind: "short-answer",
} satisfies QuestionResponse;

const rubric = {
  criteria: [
    {
      criterionKey: "criterion-1",
      label,
      levels: [
        { label, levelKey: "level-1", order: 1, points: 0 },
        { label, levelKey: "level-2", order: 2, points: 2 },
      ],
      order: 1,
    },
    {
      criterionKey: "criterion-2",
      finalAnswer: {
        acceptedAnswers: ["Paris"],
        collapseWhitespace: true,
        ignoreCase: true,
        kind: "text",
      },
      label,
      levels: [
        { label, levelKey: "level-1", order: 1, points: 0 },
        { label, levelKey: "level-2", order: 2, points: 1 },
      ],
      order: 2,
    },
  ],
  kind: "rubric",
} satisfies QuestionResponse;

describe("response/projection", () => {
  it("freezes choice and category responses in their stored shape", () => {
    expect(freeze(singleChoice, indonesian)).toEqual(singleChoice);
    expect(freeze(category, indonesian)).toEqual(category);
  });

  it("freezes typed responses with the language their answers are read in", () => {
    expect(freeze(shortAnswer, indonesian)).toEqual({
      ...shortAnswer,
      language: "id",
    });
    expect(freeze(rubric, indonesian)).toEqual({ ...rubric, language: "id" });
  });

  it("hides and reveals choice and category answer keys", () => {
    expect(project(singleChoice, false)).toEqual({
      kind: "single-choice",
      options: [
        { label: "A", optionKey: "option-1", order: 1 },
        { label: "B", optionKey: "option-2", order: 2 },
      ],
    });
    expect(project(singleChoice, true)).toEqual(singleChoice);
    expect(project(category, false)).toEqual({
      categories: category.categories,
      kind: "category",
      statements: [
        { label: "Statement", order: 1, statementKey: "statement-1" },
      ],
    });
    expect(project(category, true)).toEqual(category);
  });

  it("hides a short-answer key until review", () => {
    const spec = freeze(shortAnswer, indonesian);

    expect(project(spec, false)).toEqual({
      kind: "short-answer",
      language: "id",
    });
    expect(project(spec, true)).toEqual(spec);
  });

  it("shows only which rubric criteria take a typed final answer until review", () => {
    const spec = freeze(rubric, indonesian);
    const [judged, final] = rubric.criteria;

    expect(project(spec, false)).toEqual({
      criteria: [
        { criterionKey: "criterion-1", final: false, order: 1 },
        { criterionKey: "criterion-2", final: true, order: 2 },
      ],
      kind: "rubric",
      language: "id",
    });
    expect(project(spec, true)).toEqual({
      criteria: [
        {
          criterionKey: "criterion-1",
          final: false,
          label: judged.label,
          levels: judged.levels,
          order: 1,
        },
        {
          criterionKey: "criterion-2",
          final: true,
          finalAnswer: final.finalAnswer,
          label: final.label,
          levels: final.levels,
          order: 2,
        },
      ],
      kind: "rubric",
      language: "id",
    });
  });

  it("hides the number each typed answer was read as until review", () => {
    const choices = [
      { kind: "single-choice", optionKey: "option-1" },
      { kind: "multiple-choice", optionKeys: ["option-1", "option-2"] },
      {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      },
    ] satisfies Selection[];
    const typed = {
      kind: "short-answer",
      number: "0.5",
      text: "0,5",
    } satisfies Selection;
    const written = {
      finalAnswers: [
        { criterionKey: "criterion-1", number: "4", text: "4,0" },
        { criterionKey: "criterion-2", text: "Paris" },
      ],
      kind: "rubric",
      text: "Work",
    } satisfies Selection;

    expect(
      Arr.map(choices, (selection) => projectSelection(selection, false))
    ).toEqual(choices);
    expect(projectSelection(typed, false)).toEqual({
      kind: "short-answer",
      text: "0,5",
    });
    expect(projectSelection(written, false)).toEqual({
      finalAnswers: [
        { criterionKey: "criterion-1", text: "4,0" },
        { criterionKey: "criterion-2", text: "Paris" },
      ],
      kind: "rubric",
      text: "Work",
    });
    expect(projectSelection(typed, true)).toBe(typed);
    expect(projectSelection(written, true)).toBe(written);
  });
});
