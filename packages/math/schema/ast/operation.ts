import type {
  ConstantMathAstRead,
  ConstantMathAstValue,
} from "@repo/math/schema/ast/constant";
import {
  isSyntacticHalfIntegerPiMultiple,
  isSyntacticIntegerPiMultiple,
  readAbsolutePiMultiple,
  readCombinedPiMultiple,
  readNegatedPiMultiple,
  readProductPiMultiple,
  readQuotientPiMultiple,
} from "@repo/math/schema/ast/pi";
import type { MathAstNode } from "@repo/math/schema/ast/schema";

const INVALID_CONSTANT_MATH_AST: ConstantMathAstRead = {
  tag: "InvalidConstant",
};

/**
 * Applies unary operators while preserving exact-zero and syntactic-pi facts.
 */
export function readUnaryConstantValue(
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"],
  operand: ConstantMathAstValue
) {
  if (operator === "negate") {
    return constantMathAst(
      -operand.value,
      readNegatedPiMultiple(operand.piMultiple)
    );
  }

  if (operator === "abs") {
    return constantMathAst(
      Math.abs(operand.value),
      readAbsolutePiMultiple(operand.piMultiple)
    );
  }

  if (operator === "sqrt") {
    return operand.value < 0
      ? INVALID_CONSTANT_MATH_AST
      : finiteComputedConstantValue(Math.sqrt(operand.value));
  }

  if (operator === "sin") {
    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.sin(operand.value));
  }

  if (operator === "tan") {
    if (isSyntacticHalfIntegerPiMultiple(operand.piMultiple)) {
      return INVALID_CONSTANT_MATH_AST;
    }

    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.tan(operand.value));
  }

  if (operator === "cos") {
    return isSyntacticHalfIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.cos(operand.value));
  }

  if (operator === "exp") {
    return finiteComputedConstantValue(Math.exp(operand.value));
  }

  return operand.value <= 0
    ? INVALID_CONSTANT_MATH_AST
    : finiteComputedConstantValue(Math.log(operand.value));
}

/**
 * Applies binary operators and rejects computed underflow to false exact zero.
 */
export function readBinaryConstantValue(
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (operator === "add") {
    return finiteComputedConstantValue(left.value + right.value, {
      piMultiple: readCombinedPiMultiple(
        left.piMultiple,
        right.piMultiple,
        "add"
      ),
    });
  }

  if (operator === "subtract") {
    return finiteComputedConstantValue(left.value - right.value, {
      piMultiple: readCombinedPiMultiple(
        left.piMultiple,
        right.piMultiple,
        "subtract"
      ),
    });
  }

  if (operator === "multiply") {
    if (left.isExactZero || right.isExactZero) {
      return constantMathAst(0);
    }

    return finiteComputedConstantValue(left.value * right.value, {
      piMultiple: readProductPiMultiple(left, right),
      rejectZero: true,
    });
  }

  if (operator === "divide") {
    if (right.isExactZero) {
      return INVALID_CONSTANT_MATH_AST;
    }

    if (left.isExactZero) {
      return constantMathAst(0);
    }

    return finiteComputedConstantValue(left.value / right.value, {
      piMultiple: readQuotientPiMultiple(left, right),
      rejectZero: true,
    });
  }

  if (left.isExactZero && right.value > 0) {
    return constantMathAst(0);
  }

  return finiteComputedConstantValue(left.value ** right.value, {
    rejectZero: true,
  });
}

/**
 * Builds the successful constant read value with exact-zero metadata.
 */
function constantMathAst(
  value: number,
  piMultiple?: number
): ConstantMathAstRead {
  return {
    tag: "Constant",
    value:
      piMultiple === undefined
        ? { isExactZero: value === 0, value }
        : { isExactZero: value === 0, piMultiple, value },
  };
}

/**
 * Accepts only finite computed constants and rejects underflow when requested.
 */
function finiteComputedConstantValue(
  value: number,
  options: { piMultiple?: number; rejectZero?: boolean } = {}
): ConstantMathAstRead {
  if (!Number.isFinite(value)) {
    return INVALID_CONSTANT_MATH_AST;
  }

  if (options.rejectZero && value === 0) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return constantMathAst(value, options.piMultiple);
}
