import type { AgentLearningProfile } from "@repo/ai/types/agents";

const PLAN_ITEM_LIMIT = 5;

/** Formats selected learning program context for AI system prompts. */
export function formatLearningProfilePromptContext(
  learningProfile: AgentLearningProfile | undefined
) {
  if (!learningProfile) {
    return "- active learning profile: not selected";
  }

  return [
    "- active learning profile: selected",
    `- interests: ${learningProfile.interests.join(", ")}`,
    `- program: ${learningProfile.program.title}`,
    `- program key: ${learningProfile.program.key}`,
    `- program kind: ${learningProfile.program.kind}`,
    `- program version: ${learningProfile.program.versionLabel}`,
    `- coverage: ${learningProfile.program.coverageStatus}`,
    `- stage: ${learningProfile.stage ?? "not specified"}`,
    formatPlanItems(learningProfile.planItems),
  ].join("\n");
}

/**
 * Formats the first plan items in product-facing prompt language.
 *
 * Graph asset IDs are included only when an app route is unavailable so Nina can call
 * graph-aware tools; the prompt deliberately avoids backend field names.
 */
function formatPlanItems(planItems: AgentLearningProfile["planItems"]) {
  const visibleItems = planItems.slice(0, PLAN_ITEM_LIMIT);

  if (visibleItems.length === 0) {
    return "- first plan items: none yet";
  }

  return [
    "- first plan items:",
    ...visibleItems.map((item) => {
      const title = item.title ?? "Untitled graph item";
      const reference = item.route
        ? `route: ${item.route}`
        : `graph asset reference: ${item.content_id}`;

      return `  - ${item.position}. ${title}; ${reference}; status: ${item.status}`;
    }),
  ].join("\n");
}
