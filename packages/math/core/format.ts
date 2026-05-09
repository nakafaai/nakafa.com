import * as math from "mathjs";

const FORMAT_OPTIONS = { precision: 14 };

/** Returns a readable message for unknown caught values. */
export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Formats Math.js values without leaking implementation objects. */
export function formatValue(value: math.MathType) {
  return math.format(value, FORMAT_OPTIONS);
}

/** Builds the shared expression payload used by AI, UI, and Convex. */
export function formatExpression(node: math.MathNode) {
  return {
    expression: node.toString(),
    latex: node.toTex(),
  };
}
