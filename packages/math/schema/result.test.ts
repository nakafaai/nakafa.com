import { describe, expect, it } from "@effect/vitest";
import {
  MathCasResultSchema,
  MathResultSchema,
  mathResultMaxRows,
} from "@repo/math/schema/result";
import { Array as Arr, Result, Schema } from "effect";

const step = {
  action: "evaluate",
  items: [],
  primary: { expression: "2 + 2", latex: "2 + 2" },
  relation: { expression: "equals", latex: "=" },
  secondary: { expression: "4", latex: "4" },
};
const item = { label: "root", latex: "1", value: "1" };
const condition = { expression: "x > 0", latex: "x > 0" };
/** A result of the CAS with the lists given, and nothing else to tell it from the next. */
const result = (
  lists: Partial<
    Record<"conditions" | "items" | "steps", readonly unknown[]>
  > = {}
) => ({
  conditions: [],
  input: { expression: "2 + 2", kind: "math", operation: "evaluate" },
  items: [],
  kind: "evaluate",
  operation: "evaluate",
  primary: { expression: "2 + 2", latex: "2 + 2" },
  reason: "Exact arithmetic was checked.",
  secondary: { expression: "4", latex: "4" },
  stepStatus: "complete",
  steps: [step],
  status: "verified",
  ...lists,
});

describe("MathResultSchema", () => {
  it("decodes a CAS result", () => {
    expect(
      Schema.decodeSync(MathResultSchema)({
        conditions: [],
        input: {
          expression: "2 + 2",
          kind: "math",
          operation: "evaluate",
        },
        items: [],
        kind: "evaluate",
        operation: "evaluate",
        primary: {
          expression: "2 + 2",
          latex: "2 + 2",
        },
        reason: "Exact arithmetic was checked.",
        secondary: {
          expression: "4",
          latex: "4",
        },
        stepStatus: "complete",
        steps: [
          {
            action: "evaluate",
            items: [],
            primary: {
              expression: "2 + 2",
              latex: "2 + 2",
            },
            relation: {
              expression: "equals",
              latex: "=",
            },
            secondary: {
              expression: "4",
              latex: "4",
            },
          },
        ],
        status: "verified",
      })
    ).toMatchObject({
      kind: "evaluate",
      status: "verified",
    });
  });

  it("still reads a stored result with more rows than the CAS may return", () => {
    const stored = result({
      conditions: Arr.replicate(condition, mathResultMaxRows + 1),
      items: Arr.replicate(item, mathResultMaxRows + 1),
      steps: Arr.replicate(step, mathResultMaxRows + 1),
    });

    expect(
      Result.isSuccess(Schema.decodeUnknownResult(MathResultSchema)(stored))
    ).toBe(true);
  });
});

describe("MathCasResultSchema", () => {
  it("admits lists of exactly the most rows", () => {
    for (const lists of [
      { conditions: Arr.replicate(condition, mathResultMaxRows) },
      { items: Arr.replicate(item, mathResultMaxRows) },
      { steps: Arr.replicate(step, mathResultMaxRows) },
    ]) {
      expect(
        Result.isSuccess(
          Schema.decodeUnknownResult(MathCasResultSchema)(result(lists))
        )
      ).toBe(true);
    }
  });

  it("refuses a list of one row more, whichever list it is", () => {
    for (const lists of [
      { conditions: Arr.replicate(condition, mathResultMaxRows + 1) },
      { items: Arr.replicate(item, mathResultMaxRows + 1) },
      { steps: Arr.replicate(step, mathResultMaxRows + 1) },
    ]) {
      const decoded = Schema.decodeUnknownResult(MathCasResultSchema)(
        result(lists)
      );

      expect(Result.isFailure(decoded)).toBe(true);
      if (Result.isFailure(decoded)) {
        expect(decoded.failure.message).toContain(
          `no more than ${mathResultMaxRows} steps, items or conditions`
        );
      }
    }
  });
});
