import {
  type ExactPoint3,
  type MathAst,
  readMathAstVariableNames,
} from "@repo/math/schema/ast/schema";
import { findPlaneEquationConsistencyIssue } from "@repo/math/schema/coordinate/plane";
import { findPointLikeCoordinateIssue } from "@repo/math/schema/coordinate/point";
import type {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  CoordinatePrimitive,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";
import {
  isExactZeroPoint,
  readSortableExactScalar,
} from "@repo/math/schema/coordinate/scalar";
import { findSolidPrimitiveIssue } from "@repo/math/schema/coordinate/solid";
import { findFunctionSurfaceOutputIssue } from "@repo/math/schema/coordinate/surface";
import { Schema } from "effect";

/** Expected failure raised when coordinate primitives are not render-safe. */
export class CoordinatePrimitiveInvariantError extends Schema.TaggedError<CoordinatePrimitiveInvariantError>()(
  "CoordinatePrimitiveInvariantError",
  {
    message: Schema.String,
  }
) {}

/**
 * Finds deterministic domain and geometry issues in coordinate primitives.
 */
export function findCoordinatePrimitiveIssue(
  primitives: readonly CoordinatePrimitive[]
) {
  for (const primitive of primitives) {
    const issue = findOnePrimitiveIssue(primitive);

    if (issue) {
      return issue;
    }
  }
}

/**
 * Validates one primitive at the first seam before renderer consumption.
 */
function findOnePrimitiveIssue(primitive: CoordinatePrimitive) {
  const pointIssue = findPointLikeCoordinateIssue(primitive);
  if (pointIssue) {
    return createIssue(pointIssue);
  }

  if (primitive.kind === "vector") {
    return findZeroVectorIssue(primitive.id, primitive.vector);
  }

  if (primitive.kind === "ray") {
    return findDirectionIssue(primitive.id, primitive.direction);
  }

  if (primitive.kind === "line") {
    return findDirectionIssue(primitive.id, primitive.direction);
  }

  const solidIssue = findSolidPrimitiveIssue(primitive);
  if (solidIssue) {
    return createIssue(solidIssue);
  }

  if (primitive.kind === "plane") {
    if (isExactZeroPoint(primitive.normal)) {
      return createIssue(
        `Coordinate primitive ${primitive.id} has a zero normal vector.`
      );
    }

    const equationIssue = findFunctionSpecIssue(
      primitive.id,
      primitive.equation
    );
    if (equationIssue) {
      return equationIssue;
    }

    const consistencyIssue = findPlaneEquationConsistencyIssue(
      primitive.id,
      primitive.equation,
      primitive.normal,
      primitive.point
    );
    return consistencyIssue ? createIssue(consistencyIssue) : undefined;
  }

  if (primitive.kind === "function-surface") {
    const outputIssue = findFunctionSurfaceOutputIssue(
      primitive.id,
      primitive.outputAxis,
      primitive.function
    );

    if (outputIssue) {
      return createIssue(outputIssue);
    }

    return findFunctionSpecIssue(primitive.id, primitive.function);
  }

  if (primitive.kind === "parametric-curve") {
    return findVectorFunctionSpecIssue(primitive.id, primitive.function, 1);
  }

  if (primitive.kind === "parametric-surface") {
    return findVectorFunctionSpecIssue(primitive.id, primitive.function, 2);
  }
}

/**
 * Rejects vector primitives that collapse to the zero vector.
 */
function findZeroVectorIssue(primitiveId: string, vector: ExactPoint3) {
  if (isExactZeroPoint(vector)) {
    return createIssue(
      `Coordinate primitive ${primitiveId} has a zero vector.`
    );
  }
}

/**
 * Rejects line and ray directions that cannot determine an orientation.
 */
function findDirectionIssue(primitiveId: string, direction: ExactPoint3) {
  if (isExactZeroPoint(direction)) {
    return createIssue(
      `Coordinate primitive ${primitiveId} has a zero direction vector.`
    );
  }
}

/**
 * Validates scalar-function domains against all referenced MathAst variables.
 */
function findFunctionSpecIssue(
  primitiveId: string,
  functionSpec: CanonicalFunctionSpec
) {
  const asts = functionSpec.exclusions
    ? [functionSpec.ast, ...functionSpec.exclusions]
    : [functionSpec.ast];

  return findDomainBindingIssue(primitiveId, asts, functionSpec.domain);
}

/**
 * Validates vector-function arity before checking variable-domain binding.
 */
function findVectorFunctionSpecIssue(
  primitiveId: string,
  functionSpec: CanonicalVectorFunctionSpec,
  expectedDomainCount: number
) {
  if (functionSpec.domain.length !== expectedDomainCount) {
    return createIssue(
      `Coordinate primitive ${primitiveId} must have exactly ${expectedDomainCount} function domain variables.`
    );
  }

  return findDomainBindingIssue(
    primitiveId,
    [functionSpec.x, functionSpec.y, functionSpec.z],
    functionSpec.domain
  );
}

/**
 * Rejects duplicate, nonsortable, inverted, or missing function domains.
 */
function findDomainBindingIssue(
  primitiveId: string,
  asts: readonly MathAst[],
  domains: readonly FunctionDomain[]
) {
  const domainVariables = new Set<string>();

  for (const domain of domains) {
    if (domainVariables.has(domain.variable)) {
      return createIssue(
        `Coordinate primitive ${primitiveId} repeats function domain ${domain.variable}.`
      );
    }
    domainVariables.add(domain.variable);

    const domainIssue = findIncreasingDomainIssue(primitiveId, domain);
    if (domainIssue) {
      return domainIssue;
    }
  }

  const usedVariables = new Set<string>();
  for (const ast of asts) {
    for (const variableName of readMathAstVariableNames(ast)) {
      usedVariables.add(variableName);
    }
  }

  for (const variableName of usedVariables) {
    if (!domainVariables.has(variableName)) {
      return createIssue(
        `Coordinate primitive ${primitiveId} is missing function domain ${variableName}.`
      );
    }
  }
}

/**
 * Wraps one renderer-safety invariant as a typed schema error.
 */
function createIssue(message: string) {
  return new CoordinatePrimitiveInvariantError({ message });
}

/**
 * Requires each function domain interval to be sortable and increasing.
 */
function findIncreasingDomainIssue(
  primitiveId: string,
  domain: FunctionDomain
) {
  const min = readSortableExactScalar(domain.min);
  const max = readSortableExactScalar(domain.max);

  if (min === undefined) {
    return createIssue(
      `Coordinate primitive ${primitiveId} domain ${domain.variable} must use sortable numeric bounds.`
    );
  }

  if (max === undefined) {
    return createIssue(
      `Coordinate primitive ${primitiveId} domain ${domain.variable} must use sortable numeric bounds.`
    );
  }

  if (min >= max) {
    return createIssue(
      `Coordinate primitive ${primitiveId} domain ${domain.variable} must be increasing.`
    );
  }
}
