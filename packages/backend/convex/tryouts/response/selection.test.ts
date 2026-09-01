import { describe, expect, it } from "@effect/vitest";
import type { TryoutRuntimeResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { validateTryoutResponseSelection } from "@repo/backend/convex/tryouts/response/selection";

const singleChoice = {
  kind: "single-choice",
  options: [
    { label: "A", optionKey: "option-1", order: 1 },
    { label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies TryoutRuntimeResponseSpec;

const multipleChoice = {
  kind: "multiple-choice",
  options: [
    { label: "A", optionKey: "option-1", order: 1 },
    { label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies TryoutRuntimeResponseSpec;

const category = {
  categories: [
    { categoryKey: "category-1", label: "Yes", order: 1 },
    { categoryKey: "category-2", label: "No", order: 2 },
  ],
  kind: "category",
  statements: [
    { label: "First", order: 1, statementKey: "statement-1" },
    { label: "Second", order: 2, statementKey: "statement-2" },
  ],
} satisfies TryoutRuntimeResponseSpec;

describe("try-out learner response selection", () => {
  it("validates single-choice membership and kind", () => {
    expect(
      validateTryoutResponseSelection(singleChoice, {
        kind: "multiple-choice",
        optionKeys: ["option-1"],
      })
    ).toEqual({ reason: "kind-mismatch", valid: false });
    expect(
      validateTryoutResponseSelection(multipleChoice, {
        kind: "single-choice",
        optionKey: "option-1",
      })
    ).toEqual({ reason: "kind-mismatch", valid: false });
    expect(
      validateTryoutResponseSelection(singleChoice, {
        kind: "single-choice",
        optionKey: "missing",
      })
    ).toEqual({ reason: "selection-invalid", valid: false });
    expect(
      validateTryoutResponseSelection(singleChoice, {
        kind: "single-choice",
        optionKey: "option-2",
      })
    ).toMatchObject({
      isComplete: true,
      kind: "single-choice",
      selection: { kind: "single-choice", optionKey: "option-2" },
      valid: true,
    });
  });

  it("rejects invalid multiple-choice sets and orders a valid set", () => {
    for (const optionKeys of [
      [],
      ["option-1", "option-1"],
      ["option-1", "option-2", "missing"],
      ["missing"],
    ]) {
      expect(
        validateTryoutResponseSelection(multipleChoice, {
          kind: "multiple-choice",
          optionKeys,
        })
      ).toEqual({ reason: "selection-invalid", valid: false });
    }
    expect(
      validateTryoutResponseSelection(multipleChoice, {
        kind: "multiple-choice",
        optionKeys: ["option-2", "option-1"],
      })
    ).toMatchObject({
      isComplete: true,
      kind: "multiple-choice",
      selection: {
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-2"],
      },
      valid: true,
    });
    expect(
      validateTryoutResponseSelection(multipleChoice, {
        kind: "multiple-choice",
        optionKeys: ["option-2"],
      })
    ).toMatchObject({
      selection: { kind: "multiple-choice", optionKeys: ["option-2"] },
      valid: true,
    });
  });

  it("rejects invalid category assignments", () => {
    expect(
      validateTryoutResponseSelection(singleChoice, {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      })
    ).toEqual({ reason: "kind-mismatch", valid: false });
    for (const assignments of [
      [],
      [
        { categoryKey: "category-1", statementKey: "statement-1" },
        { categoryKey: "category-2", statementKey: "statement-1" },
      ],
      [{ categoryKey: "missing", statementKey: "statement-1" }],
      [{ categoryKey: "category-1", statementKey: "missing" }],
    ]) {
      expect(
        validateTryoutResponseSelection(category, {
          assignments,
          kind: "category",
        })
      ).toEqual({ reason: "selection-invalid", valid: false });
    }
  });

  it("orders valid category assignments and reports completeness", () => {
    expect(
      validateTryoutResponseSelection(category, {
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
        kind: "category",
      })
    ).toMatchObject({
      isComplete: false,
      kind: "category",
      valid: true,
    });
    expect(
      validateTryoutResponseSelection(category, {
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-2" },
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      })
    ).toMatchObject({
      isComplete: true,
      selection: {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
        kind: "category",
      },
      valid: true,
    });
  });
});
