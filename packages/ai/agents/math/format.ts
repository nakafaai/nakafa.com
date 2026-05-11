import type {
  MathData,
  MathExpression,
  MathItem,
  MathResult,
  MathStep,
} from "@repo/math/schema";
import dedent from "dedent";

/** Formats deterministic math evidence as model-readable markdown. */
export function formatMathData(data: MathData) {
  if (data.status === "loading") {
    return "Math evidence is loading.";
  }

  if (data.status === "error") {
    return dedent(`
      # Math Evidence

      - Status: error
      - Operation: ${data.kind}
      - Error: ${data.error}
    `);
  }

  return dedent(`
    # Math Evidence

    - Status: ${data.status}
    - Operation: ${data.result.operation}
    - Step status: ${data.result.stepStatus}
    - Primary: ${data.result.primary.expression}
    ${formatSecondary(data.result)}
    ${formatSteps(data.result.steps)}
    ${formatItems(data.result.items)}
    ${formatConditions(data.result.conditions)}
    - Reason: ${data.result.reason}
  `);
}

/** Formats the optional second expression in the CAS result. */
function formatSecondary(result: MathResult) {
  if (!result.secondary) {
    return "";
  }

  return `- Secondary: ${result.secondary.expression}`;
}

/** Formats deterministic CAS derivation steps as model-readable bullets. */
function formatSteps(steps: readonly MathStep[]) {
  if (steps.length === 0) {
    return "";
  }

  return steps
    .map((step) => {
      const relation = step.relation ? ` ${step.relation.expression}` : "";
      const secondary = step.secondary ? ` ${step.secondary.expression}` : "";
      return `- Step (${step.action}): ${step.primary.expression}${relation}${secondary}`;
    })
    .join("\n");
}

/** Formats supporting CAS rows as model-readable markdown bullets. */
function formatItems(items: readonly MathItem[]) {
  if (items.length === 0) {
    return "";
  }

  return items.map((item) => `- ${item.label}: ${item.value}`).join("\n");
}

/** Formats CAS conditions such as domain restrictions. */
function formatConditions(conditions: readonly MathExpression[]) {
  if (conditions.length === 0) {
    return "";
  }

  return conditions
    .map((condition) => `- Condition: ${condition.expression}`)
    .join("\n");
}
