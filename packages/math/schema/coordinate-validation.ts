import {
  type ExactPoint3,
  type ExactScalar,
  type MathAst,
  readMathAstVariableNames,
} from "@repo/math/schema/ast";
import type {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  CoordinatePrimitive,
  FunctionDomain,
} from "@repo/math/schema/coordinate-primitives";
import {
  isExactZeroPoint,
  readSortableExactScalar,
} from "@repo/math/schema/coordinate-scalars";
import { Schema } from "effect";

/** Expected failure raised when coordinate primitives are not render-safe. */
export class CoordinatePrimitiveInvariantError extends Schema.TaggedError<CoordinatePrimitiveInvariantError>()(
  "CoordinatePrimitiveInvariantError",
  {
    message: Schema.String,
  }
) {}

/** Finds deterministic domain and geometry issues in coordinate primitives. */
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

function findOnePrimitiveIssue(primitive: CoordinatePrimitive) {
  if (primitive.kind === "ray") {
    return findDirectionIssue(primitive.id, primitive.direction);
  }

  if (primitive.kind === "line") {
    return findDirectionIssue(primitive.id, primitive.direction);
  }

  if (primitive.kind === "cuboid") {
    return findCuboidIssue(primitive.id, primitive.min, primitive.max);
  }

  if (primitive.kind === "sphere") {
    return findPositiveScalarIssue(
      primitive.id,
      "sphere radius",
      primitive.radius
    );
  }

  if (primitive.kind === "plane") {
    if (isExactZeroPoint(primitive.normal)) {
      return createIssue(
        `Coordinate primitive ${primitive.id} has a zero normal vector.`
      );
    }

    return findFunctionSpecIssue(primitive.id, primitive.equation);
  }

  if (primitive.kind === "function-surface") {
    return findFunctionSpecIssue(primitive.id, primitive.function, 2);
  }

  if (primitive.kind === "parametric-curve") {
    return findVectorFunctionSpecIssue(primitive.id, primitive.function, 1);
  }

  if (primitive.kind === "parametric-surface") {
    return findVectorFunctionSpecIssue(primitive.id, primitive.function, 2);
  }
}

function findDirectionIssue(primitiveId: string, direction: ExactPoint3) {
  if (isExactZeroPoint(direction)) {
    return createIssue(
      `Coordinate primitive ${primitiveId} has a zero direction vector.`
    );
  }
}

function findFunctionSpecIssue(
  primitiveId: string,
  functionSpec: CanonicalFunctionSpec,
  expectedDomainCount?: number
) {
  if (
    expectedDomainCount !== undefined &&
    functionSpec.domain.length !== expectedDomainCount
  ) {
    return createIssue(
      `Coordinate primitive ${primitiveId} must have exactly ${expectedDomainCount} function domain variables.`
    );
  }

  const asts = functionSpec.exclusions
    ? [functionSpec.ast, ...functionSpec.exclusions]
    : [functionSpec.ast];

  return findDomainBindingIssue(primitiveId, asts, functionSpec.domain);
}

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

function createIssue(message: string) {
  return new CoordinatePrimitiveInvariantError({ message });
}

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

function findPositiveScalarIssue(
  primitiveId: string,
  label: string,
  scalar: ExactScalar
) {
  const value = readSortableExactScalar(scalar);

  if (value === undefined) {
    return createIssue(
      `Coordinate primitive ${primitiveId} ${label} must use a sortable numeric value.`
    );
  }

  if (value <= 0) {
    return createIssue(
      `Coordinate primitive ${primitiveId} ${label} must be positive.`
    );
  }
}

function findCuboidIssue(
  primitiveId: string,
  min: ExactPoint3,
  max: ExactPoint3
) {
  const axes = [
    { name: "x", max: max.x, min: min.x },
    { name: "y", max: max.y, min: min.y },
    { name: "z", max: max.z, min: min.z },
  ];

  for (const axis of axes) {
    const minValue = readSortableExactScalar(axis.min);
    const maxValue = readSortableExactScalar(axis.max);

    if (minValue === undefined) {
      return createIssue(
        `Coordinate primitive ${primitiveId} cuboid ${axis.name}-axis must use sortable numeric bounds.`
      );
    }

    if (maxValue === undefined) {
      return createIssue(
        `Coordinate primitive ${primitiveId} cuboid ${axis.name}-axis must use sortable numeric bounds.`
      );
    }

    if (minValue >= maxValue) {
      return createIssue(
        `Coordinate primitive ${primitiveId} cuboid ${axis.name}-axis must be increasing.`
      );
    }
  }
}
