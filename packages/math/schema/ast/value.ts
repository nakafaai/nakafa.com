import type { ConstantMathAstRead } from "@repo/math/schema/ast/constant";

/** Shared invalid read result for deterministic constant evaluation. */
export const INVALID_CONSTANT_MATH_AST: ConstantMathAstRead = {
  tag: "InvalidConstant",
};

/**
 * Builds a successful constant read result with exact-zero and pi metadata.
 */
export function constantMathAst(
  value: number,
  piMultiple?: number,
  piSquareMultiple?: number
): ConstantMathAstRead {
  if (piMultiple !== undefined) {
    return {
      tag: "Constant",
      value: { isExactZero: value === 0, piMultiple, value },
    };
  }

  if (piSquareMultiple !== undefined) {
    return {
      tag: "Constant",
      value: { isExactZero: value === 0, piSquareMultiple, value },
    };
  }

  return {
    tag: "Constant",
    value: { isExactZero: value === 0, value },
  };
}

/**
 * Accepts only finite computed constants and rejects underflow when requested.
 */
export function finiteComputedConstantValue(
  value: number,
  options: {
    piMultiple?: number;
    piSquareMultiple?: number;
    rejectZero?: boolean;
  } = {}
): ConstantMathAstRead {
  if (!Number.isFinite(value)) {
    return INVALID_CONSTANT_MATH_AST;
  }

  if (options.rejectZero && value === 0) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return constantMathAst(value, options.piMultiple, options.piSquareMultiple);
}
