import type { MathData } from "@repo/math/schema/data";
import type { MathResult } from "@repo/math/schema/result";
import type {
  MathExpression,
  MathItem,
  MathStep,
} from "@repo/math/schema/shared";
import dedent from "dedent";

/** Formats deterministic checked work as model-readable markdown. */
export function formatMathData(data: MathData, diagnostic?: string) {
  if (data.status === "loading") {
    return "Checked math work is loading.";
  }

  if (data.status === "error") {
    return dedent(`
      # Checked Math Work

      - Status: error
      - Operation: ${data.kind}
      - Evidence scope: unavailable deterministic derivation; do not describe the result as checked or proven
      - Error code: ${data.error}
      ${formatDiagnostic(diagnostic)}
    `);
  }

  return dedent(`
    # Checked Math Work

    - Status: ${data.status}
      - Operation: ${data.result.operation}
      - Step status: ${data.result.stepStatus}
      - Evidence scope: ${formatEvidenceScope(data.result)}
      - Reason: ${data.result.reason}
      - Primary: ${data.result.primary.expression}
    ${formatSecondary(data.result)}
    ${formatSteps(data.result.steps)}
    ${formatItems(data.result.items)}
    ${formatConditions(data.result.conditions)}
  `);
}

/** Formats optional model-only recovery guidance for failed math checks. */
function formatDiagnostic(diagnostic?: string) {
  if (!diagnostic) {
    return "";
  }

  return `- Recovery: ${diagnostic}`;
}

/** Formats the exact verification scope for the assistant-facing evidence. */
function formatEvidenceScope(result: MathResult) {
  if (result.stepStatus === "complete") {
    return "complete deterministic derivation";
  }

  if (result.stepStatus === "partial") {
    if (result.status === "verified") {
      return "verified deterministic result with partial derivation steps";
    }

    return "partial deterministic evidence; do not call the final result fully verified without another complete check";
  }

  if (result.status === "verified") {
    return "verified deterministic result; derivation steps are not included";
  }

  return "unavailable deterministic derivation; say the available evidence is not enough to prove the result";
}

/** Formats the optional second expression in the math result. */
function formatSecondary(result: MathResult) {
  if (result.steps.length > 0) {
    return "";
  }

  if (!result.secondary) {
    return "";
  }

  return `- Secondary: ${result.secondary.expression}`;
}

/** Formats deterministic math derivation steps as model-readable bullets. */
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

/** Formats supporting math rows as model-readable markdown bullets. */
function formatItems(items: readonly MathItem[]) {
  if (items.length === 0) {
    return "";
  }

  return items.map((item) => `- ${item.label}: ${item.value}`).join("\n");
}

/** Formats math conditions such as domain restrictions. */
function formatConditions(conditions: readonly MathExpression[]) {
  if (conditions.length === 0) {
    return "";
  }

  return conditions
    .map((condition) => `- Condition: ${condition.expression}`)
    .join("\n");
}
