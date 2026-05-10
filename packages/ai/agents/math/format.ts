import type { MathData, MathItem, MathResult } from "@repo/math/schema";
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
    - Primary: ${data.result.primary.expression}
    ${formatSecondary(data.result)}
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

/** Formats supporting CAS rows as model-readable markdown bullets. */
function formatItems(items: readonly MathItem[]) {
  if (items.length === 0) {
    return "";
  }

  return items.map((item) => `- ${item.label}: ${item.value}`).join("\n");
}

/** Formats CAS conditions such as domain restrictions. */
function formatConditions(conditions: readonly string[]) {
  if (conditions.length === 0) {
    return "";
  }

  return conditions.map((condition) => `- Condition: ${condition}`).join("\n");
}
