import { readMathAstNumber } from "@repo/math/evaluate/ast";
import type {
  ExactPoint3,
  ExactScalar,
  MathAst,
} from "@repo/math/schema/ast/schema";
import type { FunctionDomain } from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { Vector3 } from "three";

/**
 * Converts a schema-owned exact point into finite Three.js coordinates.
 */
export function readVector3(point: ExactPoint3) {
  const x = readScalarNumber(point.x);
  const y = readScalarNumber(point.y);
  const z = readScalarNumber(point.z);

  if (x === undefined || y === undefined || z === undefined) {
    return;
  }

  return new Vector3(x, y, z);
}

/**
 * Reads the exact scalar sort value used for deterministic renderer geometry.
 */
export function readScalarNumber(scalar: ExactScalar) {
  return readSortableExactScalar(scalar);
}

/**
 * Reads an increasing finite function interval from the validated domain row.
 */
export function readDomainInterval(domain: FunctionDomain) {
  const min = readScalarNumber(domain.min);
  const max = readScalarNumber(domain.max);

  if (min === undefined || max === undefined || min >= max) {
    return;
  }

  return { max, min };
}

/**
 * Evaluates one MathAst sample and drops invalid domain points for renderers.
 */
export function readSampleValue(
  ast: MathAst,
  variables: ReadonlyMap<string, number>
) {
  const result = readMathAstNumber(ast, variables);
  return result.tag === "value" ? result.value : undefined;
}
