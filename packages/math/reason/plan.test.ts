import { MathPlanningError } from "@repo/math/reason/errors";
import { planCasRequest } from "@repo/math/reason/plan";
import type { MathReasoningRequestShape } from "@repo/math/schema/work";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("planCasRequest", () => {
  it("plans equation solving with inferred variable", async () => {
    const result = await Effect.runPromise(
      planCasRequest(mathInput("solve x^2 - 5x + 6 = 0"))
    );

    expect(result).toMatchObject({
      expression: "x^2 - 5x + 6 = 0",
      operation: "solve",
      variables: ["x"],
    });
  });

  it("plans calculus and geometry first-slice operations", async () => {
    const derivative = await Effect.runPromise(
      planCasRequest(mathInput("derivative of x^3"))
    );
    const indonesianDerivative = await Effect.runPromise(
      planCasRequest(mathInput("turunan y^3"))
    );
    const integral = await Effect.runPromise(
      planCasRequest(mathInput("integral of 2x"))
    );
    const line = await Effect.runPromise(
      planCasRequest(mathInput("garis melalui (0, 0) dan (3, 2)"))
    );
    const circle = await Effect.runPromise(
      planCasRequest(mathInput("circle through (0, 0) and (1, 1)"))
    );

    expect(derivative).toMatchObject({
      expression: "x^3",
      operation: "differentiate",
      variable: "x",
    });
    expect(indonesianDerivative).toMatchObject({
      expression: "y^3",
      operation: "differentiate",
      variable: "y",
    });
    expect(integral).toMatchObject({
      expression: "2x",
      operation: "integrate",
      variable: "x",
    });
    expect(line).toMatchObject({
      operation: "line",
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    });
    expect(circle).toMatchObject({
      operation: "circle",
      points: [
        { x: "0", y: "0" },
        { x: "1", y: "1" },
      ],
    });
  });

  it("plans first-slice algebra from keywords, givens, and equations", async () => {
    const factor = await Effect.runPromise(
      planCasRequest(mathInput("faktor x^2 - 1."))
    );
    const simplify = await Effect.runPromise(
      planCasRequest(mathInput("please check", ["2x + 3x!"]))
    );
    const equation = await Effect.runPromise(
      planCasRequest(mathInput("find x", ["x + 2 = 5"]))
    );
    const numericEquation = await Effect.runPromise(
      planCasRequest(mathInput("solve 2 = 2"))
    );
    const noVariable = await Effect.runPromise(
      planCasRequest(mathInput("integral of 2"))
    );
    const preferredVariable = await Effect.runPromise(
      planCasRequest(mathInput("differentiate x + y"))
    );
    const fallbackText = await Effect.runPromise(
      planCasRequest(mathInput("check"))
    );

    expect(factor).toMatchObject({
      expression: "x^2 - 1",
      operation: "factor",
    });
    expect(simplify).toMatchObject({
      expression: "2x + 3x",
      operation: "simplify",
    });
    expect(equation).toMatchObject({
      expression: "x + 2 = 5",
      operation: "solve",
      variables: ["x"],
    });
    expect(numericEquation).toMatchObject({
      expression: "2 = 2",
      operation: "solve",
      variables: [],
    });
    expect(noVariable).toMatchObject({
      expression: "2",
      operation: "integrate",
    });
    expect(preferredVariable).toMatchObject({
      expression: "x + y",
      operation: "differentiate",
      variable: "x",
    });
    expect(fallbackText).toMatchObject({
      expression: "check\nCheck the math",
      operation: "simplify",
    });
  });

  it("keeps Indonesian learner instructions out of CAS expressions", async () => {
    const solve = await Effect.runPromise(
      planCasRequest(
        mathInput("Selesaikan x + 2 = 5 dan tunjukkan langkahnya.")
      )
    );
    const simplify = await Effect.runPromise(
      planCasRequest(mathInput("Sederhanakan 2x + 3x, lalu jelaskan."))
    );
    const factor = await Effect.runPromise(
      planCasRequest(mathInput("Faktorkan x^2 - 1 dengan rapi."))
    );
    const derivative = await Effect.runPromise(
      planCasRequest(mathInput("Tentukan turunan x^3 dan beri alasan."))
    );

    expect(solve).toMatchObject({
      expression: "x + 2 = 5",
      operation: "solve",
      variables: ["x"],
    });
    expect(simplify).toMatchObject({
      expression: "2x + 3x",
      operation: "simplify",
    });
    expect(factor).toMatchObject({
      expression: "x^2 - 1",
      operation: "factor",
    });
    expect(derivative).toMatchObject({
      expression: "x^3",
      operation: "differentiate",
      variable: "x",
    });
  });

  it("keeps descriptive linear-equation wording on the solve path", async () => {
    const solve = await Effect.runPromise(
      planCasRequest(
        mathInput(
          "Selesaikan persamaan linear satu variabel x + 2 = 5 dan tunjukkan langkahnya."
        )
      )
    );
    const englishLinear = await Effect.runPromise(
      planCasRequest(mathInput("solve the linear equation x + 2 = 5"))
    );

    expect(solve).toMatchObject({
      expression: "x + 2 = 5",
      operation: "solve",
      variables: ["x"],
    });
    expect(englishLinear).toMatchObject({
      expression: "x + 2 = 5",
      operation: "solve",
      variables: ["x"],
    });
  });

  it("does not extract one-sided equation fragments", async () => {
    const incomplete = await Effect.runPromise(
      planCasRequest(mathInput("solve x ="))
    );

    expect(incomplete).toMatchObject({
      expression: "x =",
      operation: "solve",
      variables: ["x"],
    });
  });

  it("fails typed when geometry input cannot satisfy the CAS request schema", async () => {
    const exit = await Effect.runPromiseExit(
      planCasRequest(mathInput("circle without points"))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(MathPlanningError.name);
  });

  it("fails typed when planned coordinate fields are invalid", async () => {
    const trimmedEmptyCoordinate = await Effect.runPromise(
      planCasRequest(mathInput("line through (   , 0), (1, 1), and (2, 2)"))
    );
    const invalidCoordinate = await Effect.runPromiseExit(
      planCasRequest(mathInput("line through (a&, 0) and (1, 1)"))
    );

    expect(trimmedEmptyCoordinate).toMatchObject({
      operation: "line",
      points: [
        { x: "1", y: "1" },
        { x: "2", y: "2" },
      ],
    });

    if (Exit.isSuccess(invalidCoordinate)) {
      expect.fail("Expected invalid planned fields to fail decoding.");
    }

    expect(invalidCoordinate.cause.toString()).toContain(
      MathPlanningError.name
    );
  });
});

/** Builds a decoded-shape fixture without widening literal request options. */
function mathInput(
  request: string,
  givens: readonly string[] = []
): MathReasoningRequestShape {
  return {
    givens: [...givens],
    locale: "id",
    objective: "Check the math",
    persistence: "none",
    request,
  };
}
