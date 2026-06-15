import type { AgentLearningProfile } from "@repo/ai/types/agents";
import type { LearningStage } from "@repo/contents/_types/program/schema";

const PLAN_ITEM_LIMIT = 5;
const LEARNING_STAGE_LABELS = {
  "grade-10": "Grade 10",
  "grade-11": "Grade 11",
  "grade-12": "Grade 12",
} satisfies Record<LearningStage, string>;

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
    `- stage: ${formatLearningStage(learningProfile.stage)}`,
    formatPlanItems(learningProfile.planItems),
  ].join("\n");
}

/** Formats the controlled learning-stage enum without echoing user-provided text. */
function formatLearningStage(stage: LearningStage | undefined): string {
  if (!stage) {
    return "not specified";
  }

  return LEARNING_STAGE_LABELS[stage];
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
