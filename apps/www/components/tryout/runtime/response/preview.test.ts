import { describe, expect, it } from "@effect/vitest";
import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import {
  isPreviewComplete,
  isPreviewCorrect,
} from "@/components/tryout/runtime/response/preview";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

const single = {
  kind: "single-choice",
  options: [
    { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies QuestionResponse;

const multiple = {
  kind: "multiple-choice",
  options: [
    { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: true, label: "B", optionKey: "option-2", order: 2 },
    { isCorrect: false, label: "C", optionKey: "option-3", order: 3 },
  ],
} satisfies QuestionResponse;

const category = {
  categories: [
    { categoryKey: "category-1", label: "Benar", order: 1 },
    { categoryKey: "category-2", label: "Salah", order: 2 },
  ],
  kind: "category",
  statements: [
    {
      correctCategoryKey: "category-1",
      label: "Pernyataan 1",
      order: 1,
      statementKey: "statement-1",
    },
    {
      correctCategoryKey: "category-2",
      label: "Pernyataan 2",
      order: 2,
      statementKey: "statement-2",
    },
  ],
} satisfies QuestionResponse;

describe("try-out response preview", () => {
  it("evaluates single-choice selections", () => {
    expect(isPreviewComplete(single, null)).toBe(false);
    expect(isPreviewCorrect(single, null)).toBe(false);
    expect(
      isPreviewComplete(single, {
        kind: "single-choice",
        optionKey: "missing",
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(single, {
        kind: "single-choice",
        optionKey: "option-1",
      })
    ).toBe(true);
    expect(
      isPreviewCorrect(single, {
        kind: "single-choice",
        optionKey: "option-2",
      })
    ).toBe(false);
  });

  it("requires a valid exact-set multiple-choice selection", () => {
    expect(
      isPreviewComplete(multiple, {
        kind: "multiple-choice",
        optionKeys: [],
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(multiple, {
        kind: "multiple-choice",
        optionKeys: [],
      })
    ).toBe(false);
    expect(
      isPreviewComplete(multiple, {
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-1"],
      })
    ).toBe(false);
    expect(
      isPreviewComplete(multiple, {
        kind: "multiple-choice",
        optionKeys: ["missing"],
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(multiple, {
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-2"],
      })
    ).toBe(true);
    expect(
      isPreviewCorrect(multiple, {
        kind: "multiple-choice",
        optionKeys: ["option-1"],
      })
    ).toBe(false);
  });

  it("requires every category statement and evaluates its assignments", () => {
    expect(
      isPreviewComplete(category, {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(category, {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      })
    ).toBe(false);
    expect(
      isPreviewComplete(category, {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-1" },
        ],
        kind: "category",
      })
    ).toBe(false);
    expect(
      isPreviewComplete(category, {
        assignments: [
          { categoryKey: "missing", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
        kind: "category",
      })
    ).toBe(false);
    const correct = {
      assignments: [
        { categoryKey: "category-1", statementKey: "statement-1" },
        { categoryKey: "category-2", statementKey: "statement-2" },
      ],
      kind: "category",
    } satisfies TryoutResponseSelection;
    expect(isPreviewCorrect(category, correct)).toBe(true);
    expect(
      isPreviewCorrect(category, {
        ...correct,
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
      })
    ).toBe(false);
    expect(isPreviewComplete(category, correct)).toBe(true);
  });

  it("rejects a response kind mismatch", () => {
    expect(
      isPreviewComplete(single, {
        kind: "multiple-choice",
        optionKeys: ["option-1"],
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(single, {
        kind: "multiple-choice",
        optionKeys: ["option-1"],
      })
    ).toBe(false);
    expect(
      isPreviewComplete(multiple, {
        assignments: [],
        kind: "category",
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(multiple, {
        assignments: [],
        kind: "category",
      })
    ).toBe(false);
    expect(
      isPreviewComplete(category, {
        kind: "single-choice",
        optionKey: "option-1",
      })
    ).toBe(false);
    expect(
      isPreviewCorrect(category, {
        kind: "single-choice",
        optionKey: "option-1",
      })
    ).toBe(false);
  });
});
