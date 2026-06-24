import { MathPlanningError } from "@repo/math/reason/errors";
import { planSolveRequest } from "@repo/math/reason/solve";
import type { MathRequest } from "@repo/math/schema/request";
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

    return yield* validateReasoningRequest(input.math);
  }
);

/** Routes schema-owned first-slice requests to operation-specific validators. */
function validateReasoningRequest(request: MathRequest) {
  if (request.operation === "solve") {
    return planSolveRequest(request);
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
  if (!request.expression) {
    return Effect.fail(
      new MathPlanningError({
        message: "Calculus requests need a structured expression.",
      })
    );
  }

  if (!request.variable) {
    return Effect.fail(
      new MathPlanningError({
        message: "Calculus requests need a structured variable.",
      })
    );
  }

  if (hasPartialIntegralBounds(request)) {
    return Effect.fail(
      new MathPlanningError({
        message: "Definite integrals need both structured bounds.",
      })
    );
  }

  return Effect.succeed(request);
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
  if ((request.points ?? []).length >= 2) {
    return Effect.succeed(request);
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Coordinate requests need structured point fields.",
    })
  );
}

/** Validates circle operations against explicit point semantics. */
function validateCircleRequest(request: MathRequest) {
  if ((request.points ?? []).length < 2) {
    return Effect.fail(
      new MathPlanningError({
        message: "Coordinate requests need structured point fields.",
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
