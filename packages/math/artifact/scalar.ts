import type { ExactPoint3 } from "@repo/math/schema/ast/schema";
import { ExactScalar } from "@repo/math/schema/ast/schema";
import type { CoordinateAxis } from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";

/**
 * Converts a finite derived coordinate value into exact scalar metadata.
 */
export function readNumberScalar(value: number) {
  const expression = readSortableNumberExpression(value);

  return ExactScalar.make({
    decimal: value,
    expression,
    latex: expression,
  });
}

/** Reads the finite schema-owned sort value for one artifact point axis. */
export function readPointAxisNumber(point: ExactPoint3, axis: CoordinateAxis) {
  return (
    point[axis].decimal ?? readSortableExactScalar(point[axis]) ?? Number.NaN
  );
}

/**
 * Keeps renderer-derived numeric expressions inside the scalar parser budget.
 */
function readSortableNumberExpression(value: number) {
  if (Object.is(value, -0)) {
    return "0";
  }

  return Number(value.toPrecision(15)).toString();
}
