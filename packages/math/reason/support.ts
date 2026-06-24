import { casOnlyMathOperations } from "@repo/math/schema/operations";

const CAS_ONLY_CATEGORY_TERMS = [
  "eigen",
  "matrix",
  "probability",
  "statistics",
] as const;
const CAS_ONLY_OPERATION_PATTERN = new RegExp(
  String.raw`\b(?:${[...casOnlyMathOperations, ...CAS_ONLY_CATEGORY_TERMS]
    .map(operationPattern)
    .join("|")})\b`,
  "iu"
);

/** Detects CAS operations that MathReasoning intentionally does not plan yet. */
export function detectUnsupportedMathReasoningOperation(text: string) {
  return CAS_ONLY_OPERATION_PATTERN.exec(text)?.[0];
}

/** Converts one operation/category term into a learner-text matching pattern. */
function operationPattern(operation: string) {
  return escapeRegExp(operation).replaceAll("_", String.raw`[\s_-]+`);
}

/** Escapes regex metacharacters in one machine-readable operation id. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
