import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import type { ModelMessage } from "ai";
import { Array as Arr } from "effect";

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
      content: Arr.join(
        [
          task,
          createPrompt({
            taskContext: `
            # Source Evidence Notice

            User-provided source evidence has already been retrieved.
            Use it for source-specific claims.
          `,
            toolUsageGuidelines: `
            # Tool Usage

            - Use the search tools before producing findings when the task also needs current, external, or corroborating evidence.
          `,
          }),
          "# User-Provided Source Evidence",
          Arr.join(sourceOutputs, "\n\n"),
        ],
        "\n\n"
      ),
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
      content: Arr.join(
        [
          "# Research Task",
          task,
          "# Research Notes",
          evidence ||
            createPrompt({
              taskContext: `
              No source-backed direct evidence was collected.
            `,
              detailedTaskInstructions: `
              Do not infer absence or nonexistence from failed or empty search results.
            `,
            }),
          ...formatSourceEvidence(collectedEvidence),
        ],
        "\n\n"
      ),
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

  return ["# Source Evidence With URLs", Arr.join(collectedEvidence, "\n\n")];
}
