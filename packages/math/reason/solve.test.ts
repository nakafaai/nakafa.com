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

    const scopedSystem = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expressions: ["x = 1", "y = 2"],
          variable: "x",
          variables: ["x", "y"],
        })
      )
    );

    expect(scopedSystem).toMatchObject({
      expression: undefined,
      expressions: ["x = 1", "y = 2"],
      operation: "solve",
      variable: "x",
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

  it("applies symbolic inequality requirements as structured bounds", async () => {
    const positive = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variable: "x",
          variables: ["x"],
        }),
        ["x > 0"]
      )
    );
    const interval = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: ["x"],
        }),
        ["0 < x < 3"]
      )
    );
    const emptyVariables = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: [],
        }),
        ["x > 0"]
      )
    );
    const tightened = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variable: "x",
          variables: ["x"],
        }),
        ["x > 0", "x > 3"]
      )
    );
    const upperOnly = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: ["x"],
        }),
        ["x < 3"]
      )
    );
    const existingBounds = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          lower: "-5",
          upper: "5",
          variables: ["x"],
        }),
        ["x >= 0"]
      )
    );
    const nonBoundRequirement = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: ["x"],
        }),
        ["show derivation"]
      )
    );

    expect(positive).toMatchObject({
      lower: "0",
      lowerInclusive: false,
      variable: "x",
      variables: ["x"],
    });
    expect(interval).toMatchObject({
      lower: "0",
      lowerInclusive: false,
      upper: "3",
      upperInclusive: false,
      variable: "x",
      variables: ["x"],
    });
    expect(emptyVariables).toMatchObject({
      lower: "0",
      lowerInclusive: false,
      variable: "x",
      variables: ["x"],
    });
    expect(tightened).toMatchObject({
      lower: "3",
      lowerInclusive: false,
      variable: "x",
    });
    expect(upperOnly).toMatchObject({
      upper: "3",
      upperInclusive: false,
      variable: "x",
      variables: ["x"],
    });
    expect(existingBounds).toMatchObject({
      lower: "0",
      lowerInclusive: true,
      upper: "5",
      upperInclusive: true,
      variable: "x",
    });
    expect(nonBoundRequirement).toMatchObject({
      expression: "x^2 = 4",
      operation: "solve",
      variables: ["x"],
    });
    expect(nonBoundRequirement).not.toHaveProperty("lower");
  });

  it("normalizes every symbolic inequality direction", async () => {
    const cases = [
      { expected: { lower: "0", lowerInclusive: true }, requirement: "x >= 0" },
      { expected: { upper: "3", upperInclusive: true }, requirement: "x <= 3" },
      { expected: { lower: "0", lowerInclusive: false }, requirement: "0 < x" },
      { expected: { lower: "0", lowerInclusive: true }, requirement: "0 <= x" },
      { expected: { upper: "3", upperInclusive: false }, requirement: "3 > x" },
      { expected: { upper: "3", upperInclusive: true }, requirement: "3 >= x" },
    ];

    for (const item of cases) {
      const planned = await planDefaultSolve([item.requirement]);

      expect(planned).toMatchObject({
        ...item.expected,
        variable: "x",
        variables: ["x"],
      });
    }
  });

  it("infers bounded domain variables from unambiguous structured fields", async () => {
    const fromVariables = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          lower: "0",
          lowerInclusive: false,
          variables: ["x"],
        })
      )
    );
    const fromExpression = await Effect.runPromise(
      planSolveRequest(
        solveRequest({
          expression: "t^2 = 9",
          lower: "0",
        })
      )
    );

    expect(fromVariables).toMatchObject({
      expression: "x^2 = 4",
      lower: "0",
      lowerInclusive: false,
      operation: "solve",
      variable: "x",
      variables: ["x"],
    });
    expect(fromExpression).toMatchObject({
      expression: "t^2 = 9",
      lower: "0",
      operation: "solve",
      variable: "t",
      variables: ["t"],
    });

    const fromRequirement = await Effect.runPromise(
      planSolveRequest(solveRequest({ expression: "u^2 = 16" }), ["u > 0"])
    );

    expect(fromRequirement).toMatchObject({
      expression: "u^2 = 16",
      lower: "0",
      operation: "solve",
      variable: "u",
      variables: ["u"],
    });
  });

  it("merges repeated bounds without weakening the domain", async () => {
    const exactSameLower = await planDefaultSolve(["x >= 0", "x > 0"]);
    const sameLower = await planDefaultSolve(["x > 0", "x >= 0.0"]);
    const strongerLower = await planDefaultSolve(["x > 3", "x > 0"]);
    const sameNumericLower = await planDefaultSolve(["x >= 0.0", "x > 0"]);
    const existingUpper = await planDefaultSolve(["x < 2", "x < 3"]);
    const strongerUpper = await planDefaultSolve(["x < 3", "x < 2"]);
    const equalClosedInterval = await planDefaultSolve(["0 <= x <= 0"]);
    const symbolicInterval = await Effect.runPromise(
      planSolveRequest(
        solveRequest({ expression: "x = y", variables: ["x"] }),
        ["y + 1 < x < y + 2"]
      )
    );

    expect(exactSameLower).toMatchObject({
      lower: "0",
      lowerInclusive: false,
      variable: "x",
    });
    expect(sameLower).toMatchObject({
      lower: "0",
      lowerInclusive: false,
      variable: "x",
    });
    expect(strongerLower).toMatchObject({
      lower: "3",
      lowerInclusive: false,
      variable: "x",
    });
    expect(sameNumericLower).toMatchObject({
      lower: "0.0",
      lowerInclusive: false,
      variable: "x",
    });
    expect(existingUpper).toMatchObject({
      upper: "2",
      upperInclusive: false,
      variable: "x",
    });
    expect(strongerUpper).toMatchObject({
      upper: "2",
      upperInclusive: false,
      variable: "x",
    });
    expect(equalClosedInterval).toMatchObject({
      lower: "0",
      lowerInclusive: true,
      upper: "0",
      upperInclusive: true,
      variable: "x",
    });
    expect(symbolicInterval).toMatchObject({
      lower: "y + 1",
      upper: "y + 2",
      variable: "x",
    });
  });

  it("fails typed when solve fields are insufficient", async () => {
    const missingRelation = await Effect.runPromiseExit(
      planSolveRequest(solveRequest({}))
    );
    const ambiguousBoundVariable = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x + y = 4",
          lower: "0",
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
    const mismatchedUnboundedVariable = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variable: "y",
          variables: ["x"],
        })
      )
    );
    const mismatchedRequirementVariable = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variable: "y",
          variables: ["y"],
        }),
        ["x > 0"]
      )
    );
    const mismatchedRequirementVariables = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: ["y"],
        }),
        ["x > 0"]
      )
    );
    const mixedRequirementVariables = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expressions: ["x = 1", "y = 2"],
          variables: ["x", "y"],
        }),
        ["x > 0", "y > 0"]
      )
    );
    const symbolicRequirementRelation = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x = y",
          variables: ["x", "y"],
        }),
        ["x < y"]
      )
    );
    const repeatedSymbolicLower = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x = y",
          variables: ["x"],
        }),
        ["x > y + 1", "x > y + 2"]
      )
    );
    const emptyOpenInterval = await Effect.runPromiseExit(
      planSolveRequest(
        solveRequest({
          expression: "x^2 = 4",
          variables: ["x"],
        }),
        ["0 < x < 0"]
      )
    );

    for (const request of [
      { expression: "x^2 = 4", lowerInclusive: true, variable: "x" },
      { expression: "x^2 = 4", upperInclusive: false, variable: "x" },
    ]) {
      expectPlanningFailure(
        await Effect.runPromiseExit(planSolveRequest(solveRequest(request)))
      );
    }

    expectPlanningFailure(missingRelation);
    expectPlanningFailure(ambiguousBoundVariable);
    expectPlanningFailure(mismatchedBoundVariable);
    expectPlanningFailure(mismatchedUnboundedVariable);
    expectPlanningFailure(mismatchedRequirementVariable);
    expectPlanningFailure(mismatchedRequirementVariables);
    expectPlanningFailure(mixedRequirementVariables);
    expectPlanningFailure(symbolicRequirementRelation);
    expectPlanningFailure(repeatedSymbolicLower);
    expectPlanningFailure(emptyOpenInterval);
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

/** Plans the common bounded equation used by requirement-bound examples. */
function planDefaultSolve(requirements: readonly string[]) {
  return Effect.runPromise(
    planSolveRequest(
      solveRequest({ expression: "x^2 = 4", variables: ["x"] }),
      requirements
    )
  );
}

/** Asserts that solve planning failures stay typed in the Effect error channel. */
function expectPlanningFailure(exit: Exit.Exit<unknown, unknown>) {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    return;
  }

  expect(exit.cause.toString()).toContain(MathPlanningError.name);
}
