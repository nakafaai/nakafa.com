import type { QuestionAnswerKey } from "@nakafa/aksara-contracts/question/answer";
import type { NinaFocusSource } from "@repo/backend/confect/nina/contract/focus";
import { Outcome, ResponseSpec } from "@repo/backend/confect/response/model";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import {
  Array as Arr,
  Effect,
  HashMap,
  HashSet,
  Option,
  Order,
  pipe,
  String as Str,
  Tuple,
} from "effect";

type SpecOf<K extends ResponseSpec["kind"]> =
  (typeof ResponseSpec.cases)[K]["Type"];
type Learner = NinaFocusSource["selection"];

/** Authored order of choices and category statements. */
const byOrder = Order.Struct({ order: Order.Number });

/** Formats the verified question, the learner's answer and the official explanation. */
export const formatFocusPrompt = Effect.fn("nina.prompt.focus")(function* (
  source: NinaFocusSource
) {
  const [question, explanation] = yield* Effect.all([
    projectMdxForAgentMarkdown(source.questionMdx),
    projectMdxForAgentMarkdown(source.explanationMdx),
  ]);
  return Arr.join(
    [
      "# Focused Try-out Question",
      "",
      `The learner opened Nina from question ${source.questionOrder} of their finished try-out review.`,
      `- question language: ${source.questionLocale}`,
      `- learner result: ${formatResult(source.outcome)}`,
      "",
      "## Question",
      "",
      Str.trim(question),
      "",
      formatResponse(source),
      "",
      "## Official Explanation",
      "",
      Str.trim(explanation),
    ],
    "\n"
  );
});

/** Teaching rules that only apply when a turn carries a focused question. */
export function formatFocusTaskPrompt() {
  return `
      # Focused Question Instructions

      The focused try-out question is the subject of this conversation.
      - Treat the official explanation and the marked correct answer as the source of truth. Never contradict them.
      - Explain why the correct answer is right in small steps at the learner's level.
      - If the learner answered incorrectly, name their answer and explain the misunderstanding behind it.
      - If the learner left it unanswered, show how to start the question.
      - Explain in the user's language. Quote question text and choices exactly as written.
      - Refer to choices by their content, not by letters or positions.
    `;
}

function formatResult(outcome: NinaFocusSource["outcome"]) {
  if (outcome === null) {
    return "not answered";
  }
  return Outcome.match(outcome, {
    correct: () => "answered correctly",
    incorrect: () => "answered incorrectly",
    partial: ({ points }) => `partially correct, earning ${points} points`,
    pending: () => "answered, awaiting grading",
  });
}

/** Formats the answer key beside the learner's answer for every response kind. */
function formatResponse(source: NinaFocusSource) {
  const { selection } = source;
  return ResponseSpec.match(source.responseSpec, {
    category: (spec) => formatChoices(formatCategories(spec, selection)),
    "multiple-choice": (spec) =>
      formatChoices(formatOptions(spec.options, selection)),
    rubric: (spec) => formatRubric(spec, source),
    "short-answer": (spec) =>
      Arr.join(
        [
          "## Answer Key",
          "",
          formatKey(spec.key),
          `- learner's answer: ${selection?.kind === "short-answer" ? selection.text : "no answer"}`,
        ],
        "\n"
      ),
    "single-choice": (spec) =>
      formatChoices(formatOptions(spec.options, selection)),
  });
}

function formatChoices(choices: string) {
  return Arr.join(["## Answer Choices", "", choices], "\n");
}

function formatKey(key: QuestionAnswerKey) {
  if (key.kind === "text") {
    return `- accepted answers: ${Arr.join(key.acceptedAnswers, "; ")}`;
  }
  const tolerance =
    key.tolerance === undefined
      ? ""
      : ` (${key.tolerance.kind} tolerance ${key.tolerance.value})`;
  return `- correct number: ${key.value}${tolerance}`;
}

/** Lists rubric criteria with their levels, final-answer keys, and the learner's answers. */
function formatRubric(spec: SpecOf<"rubric">, source: NinaFocusSource) {
  const selection =
    source.selection?.kind === "rubric"
      ? Option.some(source.selection)
      : Option.none();
  const typed = HashMap.fromIterable(
    Option.match(selection, {
      onNone: () => [],
      onSome: ({ finalAnswers }) =>
        Arr.map(finalAnswers, ({ criterionKey, text }) =>
          Tuple.make(criterionKey, text)
        ),
    })
  );
  const criteria = Arr.map(spec.criteria, (criterion) => {
    const levels = Arr.join(
      Arr.map(
        criterion.levels,
        ({ label, points }) =>
          `  - ${points} points: ${label[source.questionLocale]}`
      ),
      "\n"
    );
    const title = `- ${criterion.label[source.questionLocale]}`;
    if (criterion.finalAnswer === undefined) {
      return `${title}\n${levels}`;
    }
    return Arr.join(
      [
        title,
        levels,
        `  ${formatKey(criterion.finalAnswer)}`,
        `  - learner's final answer: ${Option.getOrElse(HashMap.get(typed, criterion.criterionKey), () => "no answer")}`,
      ],
      "\n"
    );
  });
  return Arr.join(
    [
      "## Rubric",
      "",
      ...criteria,
      "",
      "## Learner's Written Answer",
      "",
      Option.match(selection, {
        onNone: () => "no written answer",
        onSome: ({ text }) => Str.trim(text) || "no written answer",
      }),
    ],
    "\n"
  );
}

/** Lists category statements with the correct and the learner's category. */
function formatCategories(spec: SpecOf<"category">, selection: Learner) {
  const labels = HashMap.fromIterable(
    Arr.map(spec.categories, ({ categoryKey, label }) =>
      Tuple.make(categoryKey, label)
    )
  );
  const assigned = HashMap.fromIterable(
    selection?.kind === "category"
      ? Arr.map(selection.assignments, ({ categoryKey, statementKey }) =>
          Tuple.make(statementKey, categoryKey)
        )
      : []
  );
  const labelOf = (categoryKey: string) =>
    Option.getOrUndefined(HashMap.get(labels, categoryKey));
  return pipe(
    Arr.sort(spec.statements, byOrder),
    Arr.map((statement) =>
      Arr.join(
        [
          `- ${statement.label}`,
          `  - correct category: ${labelOf(statement.correctCategoryKey)}`,
          `  - learner's category: ${Option.match(
            HashMap.get(assigned, statement.statementKey),
            { onNone: () => "no answer", onSome: labelOf }
          )}`,
        ],
        "\n"
      )
    ),
    Arr.join("\n")
  );
}

/** Lists the choices in authored order with correctness and the learner's pick. */
function formatOptions(
  options: SpecOf<"multiple-choice" | "single-choice">["options"],
  selection: Learner
) {
  const chosen = HashSet.fromIterable(readChosenOptions(selection));
  return pipe(
    Arr.sort(options, byOrder),
    Arr.map((option) => {
      const marks = Arr.filter(
        [
          option.isCorrect ? "correct answer" : "",
          HashSet.has(chosen, option.optionKey) ? "learner's choice" : "",
        ],
        Str.isNonEmpty
      );
      return Arr.isReadonlyArrayNonEmpty(marks)
        ? `- ${option.label} (${Arr.join(marks, ", ")})`
        : `- ${option.label}`;
    }),
    Arr.join("\n")
  );
}

function readChosenOptions(selection: Learner): readonly string[] {
  if (selection?.kind === "single-choice") {
    return [selection.optionKey];
  }
  return selection?.kind === "multiple-choice" ? selection.optionKeys : [];
}
