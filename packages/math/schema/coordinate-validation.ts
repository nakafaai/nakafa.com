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
    if (primitive.kind === "ray") {
      if (isExactZeroPoint(primitive.direction)) {
        return createIssue(
          `Coordinate primitive ${primitive.id} has a zero direction vector.`
        );
      }
      continue;
    }

    if (primitive.kind === "line") {
      if (isExactZeroPoint(primitive.direction)) {
        return createIssue(
          `Coordinate primitive ${primitive.id} has a zero direction vector.`
        );
      }
      continue;
    }

    if (primitive.kind === "plane") {
      if (isExactZeroPoint(primitive.normal)) {
        return createIssue(
          `Coordinate primitive ${primitive.id} has a zero normal vector.`
        );
      }

      const domainIssue = findFunctionSpecIssue(
        primitive.id,
        primitive.equation
      );
      if (domainIssue) {
        return domainIssue;
      }
      continue;
    }

    if (primitive.kind === "function-surface") {
      const domainIssue = findFunctionSpecIssue(
        primitive.id,
        primitive.function
      );
      if (domainIssue) {
        return domainIssue;
      }
      continue;
    }

    if (primitive.kind === "parametric-curve") {
      const domainIssue = findVectorFunctionSpecIssue(
        primitive.id,
        primitive.function,
        1
      );
      if (domainIssue) {
        return domainIssue;
      }
      continue;
    }

    if (primitive.kind === "parametric-surface") {
      const domainIssue = findVectorFunctionSpecIssue(
        primitive.id,
        primitive.function,
        2
      );
      if (domainIssue) {
        return domainIssue;
      }
    }
  }
}

function findFunctionSpecIssue(
  primitiveId: string,
  functionSpec: CanonicalFunctionSpec
) {
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

  for (const variableName of domainVariables) {
    if (!usedVariables.has(variableName)) {
      return createIssue(
        `Coordinate primitive ${primitiveId} has unused function domain ${variableName}.`
      );
    }
  }
}

function createIssue(message: string) {
  return new CoordinatePrimitiveInvariantError({ message });
}

function isExactZeroPoint(point: ExactPoint3) {
  return (
    isExactZeroScalar(point.x) &&
    isExactZeroScalar(point.y) &&
    isExactZeroScalar(point.z)
  );
}

function isExactZeroScalar(scalar: ExactScalar) {
  if (scalar.decimal !== undefined) {
    return Object.is(scalar.decimal, 0);
  }

  const expression = scalar.expression.trim();

  if (expression === "0") {
    return true;
  }

  if (expression === "+0") {
    return true;
  }

  return expression === "-0";
}
