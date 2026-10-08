import { describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type {
  RenderableSpec,
  ResponseRejected,
  Selected,
  Selection,
} from "@repo/backend/confect/response/model";
import { select } from "@repo/backend/confect/response/selection";
import { Result } from "effect";

const english = DeliveryLanguageSchema.make("en");

const singleChoice = {
  kind: "single-choice",
  options: [
    { label: "A", optionKey: "option-1", order: 1 },
    { label: "B", optionKey: "option-2", order: 2 },
  ],
} satisfies RenderableSpec;

const multipleChoice = { ...singleChoice, kind: "multiple-choice" } as const;

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
} satisfies RenderableSpec;

const shortAnswer = {
  kind: "short-answer",
  language: english,
} satisfies RenderableSpec;

const rubric = {
  criteria: [
    { criterionKey: "criterion-1", final: false, order: 1 },
    { criterionKey: "criterion-2", final: true, order: 2 },
    { criterionKey: "criterion-3", final: true, order: 3 },
  ],
  kind: "rubric",
  language: english,
} satisfies RenderableSpec;

const finalOnly = {
  ...rubric,
  criteria: [{ criterionKey: "criterion-1", final: true, order: 1 }],
} satisfies RenderableSpec;

/** Returns the accepted selection, or the reason it was rejected. */
function settle(
  result: Result.Result<Selected, ResponseRejected>
): Selected | ResponseRejected["reason"] {
  return Result.match(result, {
    onFailure: ({ reason }) => reason,
    onSuccess: (selected) => selected,
  });
}

describe("response/selection", () => {
  it("rejects a selection of another response kind", () => {
    const pairs: readonly (readonly [RenderableSpec, Selection])[] = [
      [singleChoice, { kind: "multiple-choice", optionKeys: ["option-1"] }],
      [multipleChoice, { kind: "single-choice", optionKey: "option-1" }],
      [category, { kind: "short-answer", text: "1" }],
      [shortAnswer, { assignments: [], kind: "category" }],
      [rubric, { kind: "short-answer", text: "1" }],
    ];
    for (const [spec, selection] of pairs) {
      expect(settle(select(spec, selection))).toBe("kind");
    }
  });

  it("accepts one existing single choice", () => {
    expect(
      settle(
        select(singleChoice, { kind: "single-choice", optionKey: "missing" })
      )
    ).toBe("selection");
    expect(
      settle(
        select(singleChoice, { kind: "single-choice", optionKey: "option-2" })
      )
    ).toEqual({
      isComplete: true,
      selection: { kind: "single-choice", optionKey: "option-2" },
    });
  });

  it("orders a valid multiple-choice set and rejects invalid sets", () => {
    for (const optionKeys of [
      [],
      ["option-1", "option-1"],
      ["option-1", "missing"],
    ]) {
      expect(
        settle(select(multipleChoice, { kind: "multiple-choice", optionKeys }))
      ).toBe("selection");
    }
    expect(
      settle(
        select(multipleChoice, {
          kind: "multiple-choice",
          optionKeys: ["option-2", "option-1"],
        })
      )
    ).toEqual({
      isComplete: true,
      selection: {
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-2"],
      },
    });
  });

  it("orders category assignments and reports partial assignment", () => {
    for (const assignments of [
      [],
      [
        { categoryKey: "category-1", statementKey: "statement-1" },
        { categoryKey: "category-2", statementKey: "statement-1" },
      ],
      [{ categoryKey: "missing", statementKey: "statement-1" }],
      [{ categoryKey: "category-1", statementKey: "missing" }],
    ]) {
      expect(settle(select(category, { assignments, kind: "category" }))).toBe(
        "selection"
      );
    }
    expect(
      settle(
        select(category, {
          assignments: [
            { categoryKey: "category-2", statementKey: "statement-2" },
          ],
          kind: "category",
        })
      )
    ).toEqual({
      isComplete: false,
      selection: {
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
        kind: "category",
      },
    });
    expect(
      settle(
        select(category, {
          assignments: [
            { categoryKey: "category-2", statementKey: "statement-2" },
            { categoryKey: "category-1", statementKey: "statement-1" },
          ],
          kind: "category",
        })
      )
    ).toMatchObject({
      isComplete: true,
      selection: {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
      },
    });
  });

  it("keeps typed short-answer text and rejects blank text", () => {
    for (const text of ["  \t ", "\u200b", "\u2060\u00ad "]) {
      expect(settle(select(shortAnswer, { kind: "short-answer", text }))).toBe(
        "selection"
      );
    }
    expect(
      settle(
        select(shortAnswer, {
          kind: "short-answer",
          number: "9",
          text: " 0.5 ",
        })
      )
    ).toEqual({
      isComplete: true,
      selection: { kind: "short-answer", text: " 0.5 " },
    });
  });

  it("orders typed final answers and requires every typed part for completion", () => {
    const answer = (criterionKey: string, text = "4") => ({
      criterionKey,
      text,
    });
    for (const finalAnswers of [
      [answer("criterion-2"), answer("criterion-2")],
      [answer("criterion-1")],
      [answer("missing")],
      [answer("criterion-2", " ")],
      [answer("criterion-2", "\u2060")],
    ]) {
      expect(
        settle(select(rubric, { finalAnswers, kind: "rubric", text: "Work" }))
      ).toBe("selection");
    }
    for (const text of [" ", "\u200b"]) {
      expect(
        settle(select(rubric, { finalAnswers: [], kind: "rubric", text }))
      ).toBe("selection");
    }
    expect(
      settle(
        select(rubric, {
          finalAnswers: [answer("criterion-3", "x"), answer("criterion-2")],
          kind: "rubric",
          text: "\u200b",
        })
      )
    ).toEqual({
      isComplete: false,
      selection: {
        finalAnswers: [answer("criterion-2"), answer("criterion-3", "x")],
        kind: "rubric",
        text: "\u200b",
      },
    });
    expect(
      settle(
        select(rubric, {
          finalAnswers: [answer("criterion-2")],
          kind: "rubric",
          text: "Work",
        })
      )
    ).toMatchObject({ isComplete: false });
    expect(
      settle(
        select(rubric, {
          finalAnswers: [answer("criterion-2"), answer("criterion-3")],
          kind: "rubric",
          text: "Work",
        })
      )
    ).toMatchObject({ isComplete: true });
    expect(
      settle(
        select(finalOnly, {
          finalAnswers: [answer("criterion-1")],
          kind: "rubric",
          text: "",
        })
      )
    ).toMatchObject({ isComplete: true });
  });
});
