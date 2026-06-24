import { MathPlanningError } from "@repo/math/reason/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { getExpressionSymbols } from "@repo/math/schema/shared";
import { Effect } from "effect";

const boundRequirementPattern =
  /^\s*([A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9_+\-*/^().\s]+?)\s*(<=|>=|<|>)\s*([A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9_+\-*/^().\s]+?)\s*$/u;
const chainedBoundRequirementPattern =
  /^\s*([A-Za-z0-9_+\-*/^().\s]+?)\s*(<=|<)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(<=|<)\s*([A-Za-z0-9_+\-*/^().\s]+?)\s*$/u;

/** Validates and normalizes a schema-owned solve request for CAS execution. */
export const planSolveRequest = Effect.fn("MathReasoning.planSolveRequest")(
  function* (request: MathRequest, requirements: readonly string[] = []) {
    const problem = solveRelations(request);
    if (problem.length === 0) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: "Solve requests need at least one structured relation.",
        })
      );
    }

    const scopedRequest = yield* applyRequirementBounds({
      request,
      requirements,
    });
    const scope = yield* solveScope({ problem, request: scopedRequest });
    return normalizeSolveRequest({ problem, request: scopedRequest, scope });
  }
);

type SolveScope = Effect.Effect.Success<ReturnType<typeof solveScope>>;

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

/** Applies symbolic inequality requirements as structured solve bounds. */
function applyRequirementBounds({
  request,
  requirements,
}: {
  readonly request: MathRequest;
  readonly requirements: readonly string[];
}) {
  return Effect.gen(function* () {
    if (requirements.length === 0) {
      return request;
    }

    let bounds = boundsFromRequest(request);
    let requirementVariable = "";
    for (const requirement of requirements) {
      const parsed = parseRequirementBound(requirement);
      if (!parsed) {
        return yield* Effect.fail(
          new MathPlanningError({
            message:
              "Solve requirements must be structured inequality bounds or moved into semantic request fields.",
          })
        );
      }

      bounds = yield* mergeBoundSet(bounds, parsed);
      requirementVariable = yield* mergeBoundVariable(
        requirementVariable,
        parsed.variable
      );
    }

    const variable = yield* resolveRequirementVariable({
      request,
      variable: requirementVariable,
    });

    return {
      ...request,
      variable,
      lower: bounds.lower?.value,
      lowerInclusive: bounds.lower?.inclusive,
      upper: bounds.upper?.value,
      upperInclusive: bounds.upper?.inclusive,
    };
  });
}

/** Resolves solve variables from semantic fields or expression symbols. */
function solveScope({
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

  return validateBoundVariable({
    request,
    variables: inferVariables(problem),
  });
}

/** Represents one side of a structured solve domain interval. */
interface Bound {
  readonly inclusive: boolean;
  readonly value: string;
}

/** Represents lower and upper bounds parsed from symbolic requirements. */
interface BoundSet {
  readonly lower?: Bound;
  readonly upper?: Bound;
}

/** Represents a parsed symbolic requirement with an explicit variable. */
interface RequirementBoundSet extends BoundSet {
  readonly variable: string;
}

/** Reads already-structured interval fields from the request. */
function boundsFromRequest(request: MathRequest): BoundSet {
  return {
    ...(request.lower === undefined
      ? {}
      : {
          lower: {
            inclusive: request.lowerInclusive !== false,
            value: request.lower,
          },
        }),
    ...(request.upper === undefined
      ? {}
      : {
          upper: {
            inclusive: request.upperInclusive !== false,
            value: request.upper,
          },
        }),
  };
}

/** Parses one math-notation requirement into lower and upper bounds. */
function parseRequirementBound(
  requirement: string
): RequirementBoundSet | undefined {
  const chained = chainedBoundRequirementPattern.exec(requirement);
  if (chained) {
    return {
      lower: {
        inclusive: chained[2] === "<=",
        value: cleanBoundValue(chained[1]),
      },
      upper: {
        inclusive: chained[4] === "<=",
        value: cleanBoundValue(chained[5]),
      },
      variable: cleanBoundValue(chained[3]),
    };
  }

  const binary = boundRequirementPattern.exec(requirement);
  if (!binary) {
    return;
  }

  return boundFromBinaryRequirement({
    left: cleanBoundValue(binary[1]),
    operator: binary[2],
    right: cleanBoundValue(binary[3]),
  });
}

/** Converts one binary inequality into the bound side it constrains. */
function boundFromBinaryRequirement({
  left,
  operator,
  right,
}: {
  readonly left: string;
  readonly operator: string;
  readonly right: string;
}): RequirementBoundSet | undefined {
  const leftIsSymbol = isSingleSymbol(left);
  const rightIsSymbol = isSingleSymbol(right);
  if (leftIsSymbol === rightIsSymbol) {
    return;
  }

  if (leftIsSymbol) {
    if (operator === ">") {
      return { lower: { inclusive: false, value: right }, variable: left };
    }

    if (operator === ">=") {
      return { lower: { inclusive: true, value: right }, variable: left };
    }

    if (operator === "<") {
      return { upper: { inclusive: false, value: right }, variable: left };
    }

    return { upper: { inclusive: true, value: right }, variable: left };
  }

  if (operator === "<") {
    return { lower: { inclusive: false, value: left }, variable: right };
  }

  if (operator === "<=") {
    return { lower: { inclusive: true, value: left }, variable: right };
  }

  if (operator === ">") {
    return { upper: { inclusive: false, value: left }, variable: right };
  }

  return { upper: { inclusive: true, value: left }, variable: right };
}

/** Merges parsed requirement bounds without weakening existing constraints. */
function mergeBoundSet(current: BoundSet, incoming: RequirementBoundSet) {
  return Effect.gen(function* () {
    const lower = yield* mergeLowerBound(current.lower, incoming.lower);
    const upper = yield* mergeUpperBound(current.upper, incoming.upper);
    yield* validateBoundOrder({ lower, upper });
    return { lower, upper };
  });
}

/** Merges requirement variables without allowing contradictory domain scopes. */
function mergeBoundVariable(current: string, incoming: string) {
  if (current === "" || current === incoming) {
    return Effect.succeed(incoming);
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Solve requirements must constrain one domain variable.",
    })
  );
}

/** Resolves the requirement variable against already-structured solve fields. */
function resolveRequirementVariable({
  request,
  variable,
}: {
  readonly request: MathRequest;
  readonly variable: string;
}) {
  if (request.variable && request.variable !== variable) {
    return Effect.fail(
      new MathPlanningError({
        message:
          "Solve requirement bounds must constrain the requested variable.",
      })
    );
  }

  if (request.variables && !request.variables.includes(variable)) {
    return Effect.fail(
      new MathPlanningError({
        message: "Solve requirement bounds must constrain a solved variable.",
      })
    );
  }

  return Effect.succeed(variable);
}

/** Keeps the stronger lower bound, failing when ordering is ambiguous. */
function mergeLowerBound(
  current: Bound | undefined,
  incoming: Bound | undefined
) {
  if (!(current && incoming)) {
    return Effect.succeed(incoming ?? current);
  }

  return mergeSameSideBound({ current, incoming, prefer: "larger" });
}

/** Keeps the stronger upper bound, failing when ordering is ambiguous. */
function mergeUpperBound(
  current: Bound | undefined,
  incoming: Bound | undefined
) {
  if (!(current && incoming)) {
    return Effect.succeed(incoming ?? current);
  }

  return mergeSameSideBound({ current, incoming, prefer: "smaller" });
}

/** Merges repeated same-side bounds while preserving the tighter interval. */
function mergeSameSideBound({
  current,
  incoming,
  prefer,
}: {
  readonly current: Bound;
  readonly incoming: Bound;
  readonly prefer: "larger" | "smaller";
}) {
  if (current.value === incoming.value) {
    return Effect.succeed({
      inclusive: current.inclusive && incoming.inclusive,
      value: current.value,
    });
  }

  const comparison = compareFiniteBounds(current.value, incoming.value);
  if (comparison === undefined) {
    return Effect.fail(
      new MathPlanningError({
        message:
          "Repeated solve bounds need numeric ordering or one explicit structured bound.",
      })
    );
  }

  if (comparison === 0) {
    return Effect.succeed({
      inclusive: current.inclusive && incoming.inclusive,
      value: current.value,
    });
  }

  if (prefer === "larger") {
    return Effect.succeed(comparison > 0 ? current : incoming);
  }

  return Effect.succeed(comparison < 0 ? current : incoming);
}

/** Fails early when numeric lower and upper bounds cannot describe a domain. */
function validateBoundOrder({ lower, upper }: BoundSet) {
  if (!(lower && upper)) {
    return Effect.void;
  }

  const comparison = compareFiniteBounds(lower.value, upper.value);
  if (comparison === undefined || comparison < 0) {
    return Effect.void;
  }

  if (comparison === 0 && lower.inclusive && upper.inclusive) {
    return Effect.void;
  }

  return Effect.fail(
    new MathPlanningError({
      message: "Solve bounds must describe a non-empty interval.",
    })
  );
}

/** Compares finite numeric bound strings when JavaScript can do so exactly enough. */
function compareFiniteBounds(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!(Number.isFinite(leftNumber) && Number.isFinite(rightNumber))) {
    return;
  }

  return Math.sign(leftNumber - rightNumber);
}

/** Returns whether a value is one variable symbol rather than a bound expression. */
function isSingleSymbol(value: string) {
  const symbols = getExpressionSymbols(value);
  return symbols.size === 1 && symbols.has(value);
}

/** Normalizes whitespace around one exact symbolic bound value. */
function cleanBoundValue(value: string) {
  return value.trim().replaceAll(/\s+/gu, " ");
}

/** Ensures bounded solve requests resolve one unambiguous domain variable. */
function validateBoundVariable({
  request,
  variables,
}: {
  readonly request: MathRequest;
  readonly variables: readonly string[];
}) {
  if (!hasBounds(request)) {
    return Effect.succeed({
      ...(request.variable ? { variable: request.variable } : {}),
      variables: [...variables],
    });
  }

  const variable = request.variable ?? singleVariable(variables);
  if (!variable) {
    return Effect.fail(
      new MathPlanningError({
        message: "Bounded solve requests need one unambiguous domain variable.",
      })
    );
  }

  if (!variables.includes(variable)) {
    return Effect.fail(
      new MathPlanningError({
        message: "Bounded solve requests must solve the domain variable.",
      })
    );
  }

  return Effect.succeed({ variable, variables: [...variables] });
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

/** Returns the only variable in scope when the domain is unambiguous. */
function singleVariable(variables: readonly string[]) {
  if (variables.length !== 1) {
    return;
  }

  return variables[0];
}

/** Canonicalizes single-expression and system solve request fields. */
function normalizeSolveRequest({
  problem,
  request,
  scope,
}: {
  readonly problem: readonly string[];
  readonly request: MathRequest;
  readonly scope: SolveScope;
}): MathRequest {
  if (problem.length > 1) {
    return {
      ...request,
      expression: undefined,
      expressions: [...problem],
      ...(scope.variable ? { variable: scope.variable } : {}),
      variables: [...scope.variables],
    };
  }

  return {
    ...request,
    expression: problem[0],
    expressions: undefined,
    ...(scope.variable ? { variable: scope.variable } : {}),
    variables: [...scope.variables],
  };
}
