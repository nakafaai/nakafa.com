import { MathPlanningError } from "@repo/math/reason/errors";
import { planCasRequest } from "@repo/math/reason/plan";
import type { MathRequest } from "@repo/math/schema/request";
import type { MathReasoningRequestShape } from "@repo/math/schema/work";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("planCasRequest", () => {
  it("passes first-slice structured requests to CAS unchanged", async () => {
    const solve = await Effect.runPromise(
      planCasRequest(
        mathInput({
          expression: "x^2 = 4",
          variables: ["x"],
          operation: "solve",
        })
      )
    );
    const factor = await Effect.runPromise(
      planCasRequest(mathInput({ expression: "x^2 - 1", operation: "factor" }))
    );
    const derivative = await Effect.runPromise(
      planCasRequest(
        mathInput({
          expression: "x^3",
          operation: "differentiate",
          order: 2,
          variable: "x",
          variables: ["x"],
        })
      )
    );
    const inferredDerivative = await Effect.runPromise(
      planCasRequest(
        mathInput({
          expression: "t^3",
          operation: "differentiate",
        })
      )
    );
    const integral = await Effect.runPromise(
      planCasRequest(
        mathInput({
          expression: "x",
          lower: "0",
          operation: "integrate",
          upper: "1",
          variable: "x",
        })
      )
    );
    const line = await Effect.runPromise(
      planCasRequest(
        mathInput({
          operation: "line",
          points: [
            { x: "0", y: "0" },
            { x: "3", y: "2" },
          ],
        })
      )
    );
    const circle = await Effect.runPromise(
      planCasRequest(
        mathInput({
          operation: "circle",
          pointSemantics: "circle-radius-point",
          points: [
            { x: "0", y: "0" },
            { x: "3", y: "2" },
          ],
        })
      )
    );

    expect(solve).toMatchObject({
      expression: "x^2 = 4",
      operation: "solve",
      variables: ["x"],
    });
    expect(factor).toMatchObject({
      expression: "x^2 - 1",
      operation: "factor",
    });
    expect(derivative).toMatchObject({
      expression: "x^3",
      operation: "differentiate",
      order: 2,
      variable: "x",
    });
    expect(derivative).not.toHaveProperty("variables");
    expect(inferredDerivative).toMatchObject({
      expression: "t^3",
      operation: "differentiate",
      variable: "t",
    });
    expect(integral).toMatchObject({
      expression: "x",
      lower: "0",
      operation: "integrate",
      upper: "1",
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
      pointSemantics: "circle-radius-point",
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    });
  });

  it("fails typed when only learner-language text is available", async () => {
    const exit = await Effect.runPromiseExit(
      planCasRequest({
        ...baseInput,
        request: "solve x^2 = 4 line by line",
      })
    );

    expectPlanningFailure(exit);
  });

  it("fails typed for unsupported structured operations", async () => {
    const exit = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          expression: "[[1, 2], [3, 4]]",
          operation: "determinant",
        })
      )
    );

    expectPlanningFailure(exit);
  });

  it("fails typed when structured fields are insufficient", async () => {
    const missingExpression = await Effect.runPromiseExit(
      planCasRequest(mathInput({ operation: "simplify" }))
    );
    const ambiguousVariable = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({ expression: "x + y", operation: "differentiate" })
      )
    );
    const missingCalculusExpression = await Effect.runPromiseExit(
      planCasRequest(mathInput({ operation: "integrate", variable: "x" }))
    );
    const conflictingCalculusVariable = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          expression: "x^2",
          operation: "differentiate",
          variable: "x",
          variables: ["y"],
        })
      )
    );
    const partialBounds = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          expression: "x",
          lower: "0",
          operation: "integrate",
          variable: "x",
        })
      )
    );
    const missingLinePoints = await Effect.runPromiseExit(
      planCasRequest(mathInput({ operation: "line" }))
    );
    const extraLinePoint = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          operation: "line",
          points: [
            { x: "0", y: "0" },
            { x: "1", y: "1" },
            { x: "2", y: "3" },
          ],
        })
      )
    );
    const missingCirclePoints = await Effect.runPromiseExit(
      planCasRequest(mathInput({ operation: "circle" }))
    );
    const missingPoints = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({ operation: "circle", points: [{ x: "0", y: "0" }] })
      )
    );
    const ambiguousCircle = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          operation: "circle",
          points: [
            { x: "0", y: "0" },
            { x: "3", y: "2" },
          ],
        })
      )
    );
    const extraCirclePoint = await Effect.runPromiseExit(
      planCasRequest(
        mathInput({
          operation: "circle",
          pointSemantics: "circle-radius-point",
          points: [
            { x: "0", y: "0" },
            { x: "3", y: "2" },
            { x: "4", y: "4" },
          ],
        })
      )
    );

    expectPlanningFailure(missingExpression);
    expectPlanningFailure(ambiguousVariable);
    expectPlanningFailure(missingCalculusExpression);
    expectPlanningFailure(conflictingCalculusVariable);
    expectPlanningFailure(partialBounds);
    expectPlanningFailure(missingLinePoints);
    expectPlanningFailure(extraLinePoint);
    expectPlanningFailure(missingCirclePoints);
    expectPlanningFailure(missingPoints);
    expectPlanningFailure(ambiguousCircle);
    expectPlanningFailure(extraCirclePoint);
  });
});

const baseInput: Omit<MathReasoningRequestShape, "math"> = {
  givens: [],
  locale: "id",
  objective: "Check the math",
  persistence: "none",
  request: "structured math request",
  requirements: [],
};

/** Builds a decoded-shape fixture with a semantic math payload. */
function mathInput(math: Omit<MathRequest, "kind">): MathReasoningRequestShape {
  return {
    ...baseInput,
    math: {
      kind: "math",
      ...math,
    },
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
