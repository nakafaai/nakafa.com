import { MathPlanningError } from "@repo/math/reason/errors";
import { planSolveRequest } from "@repo/math/reason/solve";
import type { MathRequest } from "@repo/math/schema/request";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("planSolveRequest", () => {
  it("normalizes single equations and systems from structured fields", async () => {
    const single = await Effect.runPromise(
      planSolveRequest(solveRequest({ expression: "theta = pi" }))
    );
    const system = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expressions: ["x = 1", "y = 2"],
          variables: ["x", "y"],
        })
      )
    );

    expect(single).toMatchObject({
      expression: "theta = pi",
      operation: "solve",
      variables: ["theta"],
    });
    expect(system).toMatchObject({
      expression: undefined,
      expressions: ["x = 1", "y = 2"],
      operation: "solve",
      variables: ["x", "y"],
    });
  });

  it("preserves explicit variables and structured domain bounds", async () => {
    const bounded = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          lower: "0",
          lowerInclusive: false,
          variable: "x",
          variables: ["x"],
        })
      )
    );

    expect(bounded).toMatchObject({
      expression: "x^2 = 4",
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });

    const variableOnly = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "t^2 = 9",
          variable: "t",
        })
      )
    );

    expect(variableOnly).toMatchObject({
      expression: "t^2 = 9",
      operation: "solve",
      variable: "t",
      variables: ["t"],
    });
  });

  it("fails typed when solve fields are insufficient", async () => {
    const missingRelation = await Effect.runPromiseExit(
      planSolveRequest(solveRequest({}))
    );
    const missingBoundVariable = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          lower: "0",
          variables: ["x"],
        })
      )
    );
    const mismatchedBoundVariable = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          lower: "0",
          variable: "y",
          variables: ["x"],
        })
      )
    );

    expectPlanningFailure(missingRelation);
    expectPlanningFailure(missingBoundVariable);
    expectPlanningFailure(mismatchedBoundVariable);
  });
});

/** Builds one semantic solve request fixture. */
function solveRequest(request: Partial<MathRequest>): MathRequest {
  return {
    kind: "math",
    operation: "solve",
    ...request,
  };
}

/** Asserts that solve planning failures stay typed in the Effect error channel. */
function expectPlanningFailure(exit: Exit.Exit<unknown, unknown>) {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    return;
  }

  expect(exit.cause.toString()).toContain(MathPlanningError.name);
}
