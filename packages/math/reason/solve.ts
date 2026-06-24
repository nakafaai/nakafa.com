import { MathPlanningError } from "@repo/math/reason/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { getExpressionSymbols } from "@repo/math/schema/shared";
import { Effect } from "effect";

/** Validates and normalizes a schema-owned solve request for CAS execution. */
export const planSolveRequest = Effect.fn("MathReasoning.planSolveRequest")(
  function* (request: MathRequest) {
    const problem = solveRelations(request);
    if (problem.length === 0) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: "Solve requests need at least one structured relation.",
        })
      );
    }

    const variables = yield* solveVariables({ problem, request });
    return normalizeSolveRequest({ problem, request, variables });
  }
);

/** Reads the relation list from already-structured solve fields. */
function solveRelations(request: MathRequest) {
  const expressions = request.expressions ?? [];
  if (expressions.length > 0) {
    return [...expressions];
  }

  if (request.expression) {
    return [request.expression];
  }

  return [];
}

/** Resolves solve variables from semantic fields or expression symbols. */
function solveVariables({
  problem,
  request,
}: {
  readonly problem: readonly string[];
  readonly request: MathRequest;
}) {
  const variables = request.variables ?? [];
  if (variables.length > 0) {
    return validateBoundVariable({ request, variables });
  }

  if (request.variable) {
    return validateBoundVariable({ request, variables: [request.variable] });
  }

  const inferred = inferVariables(problem);
  return validateBoundVariable({ request, variables: inferred });
}

/** Ensures bounded solve requests name one solved domain variable. */
function validateBoundVariable({
  request,
  variables,
}: {
  readonly request: MathRequest;
  readonly variables: readonly string[];
}) {
  if (!hasBounds(request)) {
    return Effect.succeed([...variables]);
  }

  if (!request.variable) {
    return Effect.fail(
      new MathPlanningError({
        message: "Bounded solve requests need a structured domain variable.",
      })
    );
  }

  if (!variables.includes(request.variable)) {
    return Effect.fail(
      new MathPlanningError({
        message: "Bounded solve requests must solve the domain variable.",
      })
    );
  }

  return Effect.succeed([...variables]);
}

/** Returns whether a solve request includes a structured domain interval. */
function hasBounds(request: MathRequest) {
  return (
    request.lower !== undefined ||
    request.lowerInclusive !== undefined ||
    request.upper !== undefined ||
    request.upperInclusive !== undefined
  );
}

/** Infers variables from symbolic math expressions when no field is provided. */
function inferVariables(problem: readonly string[]) {
  const symbols = new Set(
    problem.flatMap((relation) => [...getExpressionSymbols(relation)])
  );

  return [...symbols];
}

/** Canonicalizes single-expression and system solve request fields. */
function normalizeSolveRequest({
  problem,
  request,
  variables,
}: {
  readonly problem: readonly string[];
  readonly request: MathRequest;
  readonly variables: readonly string[];
}): MathRequest {
  if (problem.length > 1) {
    return {
      ...request,
      expression: undefined,
      expressions: [...problem],
      variables: [...variables],
    };
  }

  return {
    ...request,
    expression: problem[0],
    expressions: undefined,
    variables: [...variables],
  };
}
