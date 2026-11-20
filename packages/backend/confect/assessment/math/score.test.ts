import { describe, expect, it } from "@effect/vitest";
import { scoreMath } from "@repo/backend/confect/assessment/math/score";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";

/** The key of the derivative of f(x) = x^3 - 2x^2, worth two points. */
const KEY = "3x^2-4x";
const CEILING = 2;

describe("assessment/math scoreMath", () => {
  it.each([
    ["proven", "x(3x-4)"],
    ["sampled", "x\\cdot\\frac{(3x-4)\\sin^2x+(3x-4)\\cos^2x}{1}"],
  ])("scores a %s answer with every point, as a consumer try-out does", (_outcome, answer) => {
    expect(scoreMath(KEY, { text: answer }, CEILING)).toEqual({
      category: CEILING,
      ceiling: CEILING,
      status: "scored",
    });
  });

  it.each<readonly [string, ExamResponse]>([
    ["a near miss", { text: "3x^2+4x" }],
    ["no expression", { text: "3x^2-4x=0" }],
    ["a choice instead of text", ["option-1"]],
  ])("scores %s with nothing", (_case, response) => {
    expect(scoreMath(KEY, response, CEILING)).toEqual({
      category: 0,
      ceiling: CEILING,
      status: "scored",
    });
  });

  it("leaves the answer to a person when the key is no expression the grader reads", () => {
    expect(scoreMath("(-\\infty, 2]", { text: "x" }, CEILING)).toEqual({
      ceiling: CEILING,
      status: "pending",
    });
  });
});
