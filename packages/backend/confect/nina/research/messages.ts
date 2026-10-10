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
 * Synthesis only runs when at least one source was retrieved. A learner's
 * source that could not be read is named, so a limitation can say so.
 */
export function createResearchSynthesisMessages({
  evidence,
  task,
  unread,
}: {
  evidence: readonly string[];
  task: string;
  unread: readonly string[];
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
          ...formatUnreadSources(unread),
        ],
        "\n\n"
      ),
    },
  ] satisfies ModelMessage[];
}

/** Names the learner's sources that could not be read; they are not evidence. */
export function formatUnreadSources(unread: readonly string[]) {
  if (unread.length === 0) {
    return [];
  }
  return [
    "# Sources That Could Not Be Read",
    "These user-provided sources returned no content. Do not cite them or describe what they say.",
    Arr.join(
      Arr.map(unread, (url) => `- ${url}`),
      "\n"
    ),
  ];
}
