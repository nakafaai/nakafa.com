import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import type { ModelMessage } from "ai";
import { Array as Arr } from "effect";

/**
 * Shows the search step what the learner's own links already gave, so its
 * queries look for what they do not cover.
 */
export function createResearchSearchMessages(
  task: string,
  sourceOutputs: readonly string[]
) {
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

            The user-provided sources below are already retrieved.
            Search for current, external, or corroborating evidence they do not cover.
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
 * Synthesis only runs when at least one source was retrieved.
 */
export function createResearchSynthesisMessages({
  evidence,
  task,
}: {
  evidence: readonly string[];
  task: string;
}) {
  return [
    {
      role: "user",
      content: Arr.join(
        [
          "# Research Task",
          task,
          "# Source Evidence With URLs",
          Arr.join(evidence, "\n\n"),
        ],
        "\n\n"
      ),
    },
  ] satisfies ModelMessage[];
}
