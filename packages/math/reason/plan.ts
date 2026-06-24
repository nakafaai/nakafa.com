import { MathPlanningError } from "@repo/math/reason/errors";
import { planSolveRequest } from "@repo/math/reason/solve";
import type { MathRequest } from "@repo/math/schema/request";
import { getExpressionSymbols } from "@repo/math/schema/shared";
import type { MathReasoningRequestShape } from "@repo/math/schema/work";
import { Effect } from "effect";

/** Plans one schema-owned MathReasoning request into a deterministic CAS request. */
export const planCasRequest = Effect.fn("MathReasoning.planCasRequest")(
  function* (input: MathReasoningRequestShape) {
    if (!input.math) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: "MathReasoning needs a structured math request.",
        })
      );
    }

    return yield* validateReasoningRequest({
      request: input.math,
      requirements: input.requirements,
    });
  }
);

/** Routes schema-owned first-slice requests to operation-specific validators. */
function validateReasoningRequest({
  request,
  requirements,
}: {
  readonly request: MathRequest;
  readonly requirements: readonly string[];
}) {
  if (request.operation === "solve") {
    return planSolveRequest(request, requirements);
  }

  if (request.operation === "line") {
    return validateLineRequest(request);
  }

  if (request.operation === "circle") {
    return validateCircleRequest(request);
  }

  if (
    request.operation === "differentiate" ||
    request.operation === "integrate"
  ) {
    return validateCalculusRequest(request);
  }

  if (request.operation === "factor" || request.operation === "simplify") {
    return validateExpressionRequest(request);
  }

  return Effect.fail(
    new MathPlanningError({
      message: "MathReasoning does not yet plan this operation.",
    })
  );
}

/** Validates algebra operations that need one structured expression. */
function validateExpressionRequest(request: MathRequest) {
  if (request.expression) {
    return Effect.succeed(request);
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Algebra requests need a structured expression.",
    })
  );
}

/** Validates calculus operations without parsing learner-language metadata. */
function validateCalculusRequest(request: MathRequest) {
  return Effect.gen(function* () {
    if (!request.expression) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: "Calculus requests need a structured expression.",
        })
      );
    }

    const variable = yield* calculusVariable(request, request.expression);

    if (hasPartialIntegralBounds(request)) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: "Definite integrals need both structured bounds.",
        })
      );
    }

    return yield* normalizeCalculusScope({ request, variable });
  });
}

/** Keeps calculus requests scoped to one semantic variable field. */
function normalizeCalculusScope({
  request,
  variable,
}: {
  readonly request: MathRequest;
  readonly variable: string;
}) {
  const { variables, ...requestWithoutVariables } = request;
  const requestedVariables = variables ?? [];
  if (requestedVariables.length > 0 && !requestedVariables.includes(variable)) {
    return Effect.fail(
      new MathPlanningError({
        message: "Calculus variable fields must name the same target.",
      })
    );
  }

  return Effect.succeed({ ...requestWithoutVariables, variable });
}

/** Returns whether a request has exactly one integral endpoint. */
function hasPartialIntegralBounds(request: MathRequest) {
  return (
    (request.lower === undefined && request.upper !== undefined) ||
    (request.lower !== undefined && request.upper === undefined)
  );
}

/** Validates line operations against already-structured point fields. */
function validateLineRequest(request: MathRequest) {
  if ((request.points ?? []).length === 2) {
    return Effect.succeed(request);
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Line requests need exactly two structured points.",
    })
  );
}

/** Validates circle operations against explicit point semantics. */
function validateCircleRequest(request: MathRequest) {
  if ((request.points ?? []).length !== 2) {
    return Effect.fail(
      new MathPlanningError({
        message:
          "Circle requests need exactly two structured points for radius-point semantics.",
      })
    );
  }

  if (request.pointSemantics !== "circle-radius-point") {
    return Effect.fail(
      new MathPlanningError({
        message: "Circle requests need structured point semantics.",
      })
    );
  }

  return Effect.succeed(request);
}

/** Resolves calculus variables from semantic fields or one expression symbol. */
function calculusVariable(request: MathRequest, expression: string) {
  if (request.variable) {
    return Effect.succeed(request.variable);
  }

  const symbols = [...getExpressionSymbols(expression)];
  if (symbols.length === 1) {
    return Effect.succeed(symbols.join(""));
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Calculus requests need a structured or unambiguous variable.",
    })
  );
}
