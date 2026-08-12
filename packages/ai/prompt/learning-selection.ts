import type { AgentLearningSelection } from "@repo/ai/types/agents";

/** Formats the canonical learner interest and signed program for AI prompts. */
export function formatLearningSelectionPromptContext(
  selection: AgentLearningSelection | undefined
) {
  if (!selection) {
    return "- active learning selection: not selected";
  }

  return [
    "- active learning selection: selected",
    `- interest: ${selection.interest}`,
    `- program: ${selection.program.title}`,
    `- program key: ${selection.program.key}`,
    `- program kind: ${selection.program.kind}`,
    `- program version: ${selection.program.versionLabel}`,
    `- coverage: ${selection.program.coverageStatus}`,
  ].join("\n");
}
