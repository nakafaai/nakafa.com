import type { AgentCurriculumPreference } from "@repo/ai/types/agents";

/** Formats the user's canonical curriculum preference for AI prompts. */
export function formatCurriculumPreferencePromptContext(
  preference: AgentCurriculumPreference | undefined
) {
  if (!preference) {
    return "- curriculum preference: not selected";
  }

  return [
    "- curriculum preference: selected",
    `- curriculum: ${preference.program.title}`,
    `- curriculum key: ${preference.program.key}`,
  ].join("\n");
}
