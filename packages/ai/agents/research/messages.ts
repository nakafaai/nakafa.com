import type { ModelMessage } from "ai";

/**
 * Adds pre-fetched source evidence without disabling normal research tools.
 */
export function createResearchMessages(
  intent: string,
  sourceOutputs: string[]
) {
  if (sourceOutputs.length === 0) {
    return [{ role: "user", content: intent }] satisfies ModelMessage[];
  }

  return [
    {
      role: "user",
      content: [
        intent,
        "User-provided source evidence has already been retrieved. Use it for source-specific claims. If the research task also needs current, external, or corroborating evidence, use the search tools before producing findings.",
        "# User-Provided Source Evidence",
        sourceOutputs.join("\n\n"),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

/**
 * Gives structured synthesis the collected evidence without exposing tools.
 */
export function createResearchSynthesisMessages({
  evidence,
  intent,
  sourceOutputs,
}: {
  evidence: string;
  intent: string;
  sourceOutputs: string[];
}) {
  return [
    {
      role: "user",
      content: [
        "# Research Task",
        intent,
        "# Collected Evidence",
        evidence || "No usable evidence was collected.",
        ...formatSourceEvidence(sourceOutputs),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

/**
 * Keeps exact user-provided source evidence explicit in synthesis.
 */
function formatSourceEvidence(sourceOutputs: string[]) {
  if (sourceOutputs.length === 0) {
    return [];
  }

  return ["# User-Provided Source Evidence", sourceOutputs.join("\n\n")];
}
