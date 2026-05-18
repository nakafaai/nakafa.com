import type { ModelMessage } from "ai";
import dedent from "dedent";

/**
 * Adds pre-fetched source evidence without disabling normal research tools.
 */
export function createResearchMessages(task: string, sourceOutputs: string[]) {
  if (sourceOutputs.length === 0) {
    return [{ role: "user", content: task }] satisfies ModelMessage[];
  }

  return [
    {
      role: "user",
      content: [
        task,
        dedent(`
          User-provided source evidence has already been retrieved.
          Use it for source-specific claims.
          If the research task also needs current, external, or corroborating evidence:
          - Use the search tools before producing findings.
        `),
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
  collectedEvidence = [],
  evidence,
  task,
}: {
  collectedEvidence?: string[];
  evidence: string;
  task: string;
}) {
  return [
    {
      role: "user",
      content: [
        "# Research Task",
        task,
        "# Research Notes",
        evidence ||
          dedent(`
            No source-backed direct evidence was collected.
            Do not infer absence or nonexistence from failed or empty search results.
          `),
        ...formatSourceEvidence(collectedEvidence),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

/**
 * Keeps exact tool source evidence explicit in synthesis.
 */
function formatSourceEvidence(collectedEvidence: string[]) {
  if (collectedEvidence.length === 0) {
    return [];
  }

  return ["# Source Evidence With URLs", collectedEvidence.join("\n\n")];
}
