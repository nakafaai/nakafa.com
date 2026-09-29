import type { NinaFocusSource } from "@repo/backend/confect/nina/contract/focus";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Effect } from "effect";

type ResponseSpec = NinaFocusSource["responseSpec"];
type Selection = NinaFocusSource["selection"];

/** Formats the verified question, the learner's answer and the official explanation. */
export const formatFocusPrompt = Effect.fn("nina.prompt.focus")(function* (
  source: NinaFocusSource
) {
  const [question, explanation] = yield* Effect.all([
    projectMdxForAgentMarkdown(source.questionMdx),
    projectMdxForAgentMarkdown(source.explanationMdx),
  ]);
  return [
    "# Focused Try-out Question",
    "",
    `The learner opened Nina from question ${source.questionOrder} of their finished try-out review.`,
    `- question language: ${source.questionLocale}`,
    `- learner result: ${formatResult(source.selection, source.isCorrect)}`,
    "",
    "## Question",
    "",
    question.trim(),
    "",
    "## Answer Choices",
    "",
    formatChoices(source.responseSpec, source.selection),
    "",
    "## Official Explanation",
    "",
    explanation.trim(),
  ].join("\n");
});

/** Teaching rules that only apply when a turn carries a focused question. */
export function formatFocusTaskPrompt() {
  return `
      # Focused Question Instructions

      The focused try-out question is the subject of this conversation.
      - Treat the official explanation and the marked correct choice as the source of truth. Never contradict them.
      - Explain why the correct answer is right in small steps at the learner's level.
      - If the learner chose incorrectly, name their choice and explain the misunderstanding behind it.
      - If the learner left it unanswered, show how to start the question.
      - Explain in the user's language. Quote question text and choices exactly as written.
      - Refer to choices by their content, not by letters or positions.
    `;
}

function formatResult(selection: Selection, isCorrect: boolean | null) {
  if (selection === null) {
    return "not answered";
  }
  return isCorrect ? "answered correctly" : "answered incorrectly";
}

/** Lists the choices in authored order with correctness and the learner's pick. */
function formatChoices(spec: ResponseSpec, selection: Selection) {
  if (spec.kind === "category") {
    const labels = new Map(
      spec.categories.map((category) => [category.categoryKey, category.label])
    );
    const assigned = new Map(
      selection?.kind === "category"
        ? selection.assignments.map((assignment) => [
            assignment.statementKey,
            assignment.categoryKey,
          ])
        : []
    );
    return [...spec.statements]
      .sort((left, right) => left.order - right.order)
      .map((statement) => {
        const chosen = assigned.get(statement.statementKey);
        return [
          `- ${statement.label}`,
          `  - correct category: ${labels.get(statement.correctCategoryKey)}`,
          `  - learner's category: ${chosen === undefined ? "no answer" : labels.get(chosen)}`,
        ].join("\n");
      })
      .join("\n");
  }
  const chosen = new Set(readChosenOptions(selection));
  return [...spec.options]
    .sort((left, right) => left.order - right.order)
    .map((option) => {
      const marks = [
        option.isCorrect ? "correct answer" : "",
        chosen.has(option.optionKey) ? "learner's choice" : "",
      ].filter(Boolean);
      return marks.length > 0
        ? `- ${option.label} (${marks.join(", ")})`
        : `- ${option.label}`;
    })
    .join("\n");
}

function readChosenOptions(selection: Selection) {
  if (selection?.kind === "single-choice") {
    return [selection.optionKey];
  }
  if (selection?.kind === "multiple-choice") {
    return selection.optionKeys;
  }
  return [];
}
