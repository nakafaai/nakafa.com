import { MathPlanningError } from "@repo/math/reason/errors";
import { planCasRequest } from "@repo/math/reason/plan";
import type { MathReasoningRequestShape } from "@repo/math/schema/work";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("planCasRequest solve safety", () => {
  it("preserves solve constraints, systems, and multi-character identifiers", async () => {
    const constrained = await Effect.runPromise(
      planCasRequest(mathInput("solve x^2 = 4 with x > 0"))
    );
    const system = await Effect.runPromise(
      planCasRequest(mathInput("solve x = 1 and y = 2"))
    );
    const trig = await Effect.runPromise(
      planCasRequest(mathInput("solve sin(x) = 0"))
    );
    const named = await Effect.runPromise(
      planCasRequest(mathInput("solve theta = pi"))
    );

    expect(constrained).toMatchObject({
      expression: "x^2 = 4",
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });
    expect(system).toMatchObject({
      expressions: ["x = 1", "y = 2"],
      operation: "solve",
      variables: ["x", "y"],
    });
    expect(trig).toMatchObject({
      expression: "sin(x) = 0",
      operation: "solve",
      variables: ["x"],
    });
    expect(named).toMatchObject({
      expression: "theta = pi",
      operation: "solve",
      variables: ["theta"],
    });
  });

  it("uses requirements as solve constraints instead of dropping them", async () => {
    const constrained = await Effect.runPromise(
      planCasRequest({
        ...mathInput("solve x^2 = 4"),
        requirements: ["x > 0"],
      })
    );

    expect(constrained).toMatchObject({
      expression: "x^2 = 4",
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });
  });

  it("normalizes upper bounds and reversed inequalities", async () => {
    const upper = await Effect.runPromise(
      planCasRequest(mathInput("solve x^2 = 4 with x <= 10"))
    );
    const reversedUpper = await Effect.runPromise(
      planCasRequest(mathInput("solve x^2 = 4 with 10 >= x"))
    );
    const reversedLower = await Effect.runPromise(
      planCasRequest(mathInput("solve x^2 = 4 with 0 < x"))
    );

    expect(upper).toMatchObject({
      expression: "x^2 = 4",
      upper: "10",
      upperInclusive: true,
    });
    expect(reversedUpper).toMatchObject({
      expression: "x^2 = 4",
      upper: "10",
      upperInclusive: true,
    });
    expect(reversedLower).toMatchObject({
      expression: "x^2 = 4",
      lower: "0",
      lowerInclusive: false,
    });
  });

  it("keeps pure inequality systems as relations instead of domain metadata", async () => {
    const relationSystem = await Effect.runPromise(
      planCasRequest(mathInput("solve x > 0 and x < 2"))
    );
    const constantRelation = await Effect.runPromise(
      planCasRequest(mathInput("solve x = 1 with 1 < 2"))
    );

    expect(relationSystem).toMatchObject({
      expressions: ["x > 0", "x < 2"],
      operation: "solve",
      variables: ["x"],
    });
    expect(constantRelation).toMatchObject({
      expressions: ["x = 1", "1 < 2"],
      operation: "solve",
      variables: ["x"],
    });
  });

  it("fails typed for unsupported advertised CAS operations", async () => {
    const matrix = await Effect.runPromiseExit(
      planCasRequest(mathInput("find the determinant of [[1, 2], [3, 4]]"))
    );
    const series = await Effect.runPromiseExit(
      planCasRequest(mathInput("expand the series of sin(x)"))
    );
    const probability = await Effect.runPromiseExit(
      planCasRequest(mathInput("find the probability of rolling a six"))
    );
    const statistics = await Effect.runPromiseExit(
      planCasRequest(mathInput("calculate statistics for 1, 2, 3"))
    );

    expectPlanningFailure(matrix);
    expectPlanningFailure(series);
    expectPlanningFailure(probability);
    expectPlanningFailure(statistics);
  });

  it("fails typed for ambiguous or mismatched variables", async () => {
    const ambiguous = await Effect.runPromiseExit(
      planCasRequest(mathInput("differentiate x + y"))
    );
    const explicit = await Effect.runPromise(
      planCasRequest(mathInput("differentiate x + y with respect to y"))
    );
    const missingVariable = await Effect.runPromiseExit(
      planCasRequest(mathInput("differentiate x^2 with respect to y"))
    );
    const wrongBoundVariable = await Effect.runPromiseExit(
      planCasRequest(mathInput("solve x^2 = 4 with y > 0"))
    );
    const mixedBoundVariables = await Effect.runPromiseExit(
      planCasRequest(mathInput("solve x^2 = 4 with x > 0 and y < 2"))
    );

    expectPlanningFailure(ambiguous);
    expectPlanningFailure(missingVariable);
    expectPlanningFailure(wrongBoundVariable);
    expectPlanningFailure(mixedBoundVariables);
    expect(explicit).toMatchObject({
      expression: "x + y",
      operation: "differentiate",
      variable: "y",
    });
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
    requirements: [],
  };
}

/** Asserts that planner failures stay typed in the Effect error channel. */
function expectPlanningFailure(exit: Exit.Exit<unknown, unknown>) {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    return;
  }

  expect(exit.cause.toString()).toContain(MathPlanningError.name);
}
