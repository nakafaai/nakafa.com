import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  chosenOptions,
  type ExamCell,
  type ExamPair,
  type ExamResponse,
  madePairs,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import type { NinaFocusSource } from "@repo/backend/confect/nina/contract/focus";
import type { PlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { documentMarkdown } from "@repo/contents/llms/document";
import { Array as Arr, Option, String as Str } from "effect";

type Of<T, K> = Extract<T, { readonly kind: K }>;
/** A labelled part of an interaction: an option, a statement, a column, or one end of a pair. */
type Part = Pick<Of<Interaction, "choice">["options"][number], "id" | "label">;

/** One labelled part of an interaction on one line, as the agent reads it. */
const labelOf = (part: Part) =>
  Str.replaceAll("\n", " ")(documentMarkdown(part.label));

/** The label of the part with an id, or a note that the answer names none. */
const labelFor = (parts: readonly Part[], id: Option.Option<string>) =>
  Option.getOrElse(
    Option.map(
      Option.flatMap(id, (wanted) =>
        Arr.findFirst(parts, (part) => part.id === wanted)
      ),
      labelOf
    ),
    () => "no answer"
  );

/** Writes one part with the marks that apply to it, such as the correct answer and the learner's choice. */
function marked(label: string, marks: readonly (string | false)[]) {
  const shown = Arr.filter(marks, (mark): mark is string => mark !== false);
  return Arr.isReadonlyArrayNonEmpty(shown)
    ? `- ${label} (${Arr.join(shown, ", ")})`
    : `- ${label}`;
}

/** Lists a choice's options, each with whether it is correct and whether the learner chose it. */
function formatChoice(
  choice: Of<Interaction, "choice">,
  key: Of<InteractionKey, "choice">,
  response: ExamResponse
) {
  const chosen = chosenOptions(response);
  return Arr.join(
    [
      "## Answer Choices",
      "",
      ...Arr.map(choice.options, (option) =>
        marked(labelOf(option), [
          Arr.contains(key.correct, option.id) && "correct answer",
          Arr.contains(chosen, option.id) && "learner's choice",
        ])
      ),
    ],
    "\n"
  );
}

/** Lists a table's statements, each with its correct column and the learner's column. */
function formatMatrix(
  matrix: Of<Interaction, "matrix">,
  key: Of<InteractionKey, "matrix">,
  response: ExamResponse
) {
  const cells = markedCells(response);
  return Arr.join(
    [
      "## Statements",
      "",
      ...Arr.map(matrix.statements, (statement) => {
        const columnFrom = (rows: readonly ExamCell[]) =>
          labelFor(
            matrix.columns,
            Option.map(
              Arr.findFirst(rows, (row) => row.statement === statement.id),
              ({ column }) => column
            )
          );
        return Arr.join(
          [
            `- ${labelOf(statement)}`,
            `  - correct column: ${columnFrom(key.answers)}`,
            `  - learner's column: ${columnFrom(cells)}`,
          ],
          "\n"
        );
      }),
    ],
    "\n"
  );
}

/** Lists a match's statements, each with its correct answer and the learner's answer. */
function formatMatch(
  match: Of<Interaction, "match">,
  key: Of<InteractionKey, "match">,
  response: ExamResponse
) {
  const made = madePairs(response);
  return Arr.join(
    [
      "## Pairs",
      "",
      ...Arr.map(match.sources, (source) => {
        const targetFrom = (pairs: readonly ExamPair[]) =>
          labelFor(
            match.targets,
            Option.map(
              Arr.findFirst(pairs, (pair) => pair.source === source.id),
              ({ target }) => target
            )
          );
        return Arr.join(
          [
            `- ${labelOf(source)}`,
            `  - correct pair: ${targetFrom(key.pairs)}`,
            `  - learner's pair: ${targetFrom(made)}`,
          ],
          "\n"
        );
      }),
    ],
    "\n"
  );
}

/** Writes a text entry's accepted answers beside the learner's typed answer. */
function formatTextEntry(
  key: Of<InteractionKey, "textEntry">,
  response: ExamResponse
) {
  return Arr.join(
    [
      "## Answer Key",
      "",
      `- accepted answers: ${Arr.join(key.accepted.acceptedAnswers, "; ")}`,
      `- learner's answer: ${Str.trim(typedText(response)) || "no answer"}`,
    ],
    "\n"
  );
}

/**
 * Formats the focused question's answer section from its frozen interaction and key: a choice's
 * options, a table's statements, a match's pairs, or a text entry's accepted answers, each beside the
 * learner's answer. Any other interaction shows the learner's written answer alone.
 */
export function formatFocusAnswer(
  question: PlacedQuestion,
  response: ExamResponse | null
) {
  const answered = response ?? NO_RESPONSE;
  const { interaction, key } = question;
  if (interaction.kind === "choice" && key.kind === "choice") {
    return formatChoice(interaction, key, answered);
  }
  if (interaction.kind === "matrix" && key.kind === "matrix") {
    return formatMatrix(interaction, key, answered);
  }
  if (interaction.kind === "match" && key.kind === "match") {
    return formatMatch(interaction, key, answered);
  }
  if (interaction.kind === "textEntry" && key.kind === "textEntry") {
    return formatTextEntry(key, answered);
  }
  return Arr.join(
    [
      "## Learner's Answer",
      "",
      Str.trim(typedText(answered)) || "no written answer",
    ],
    "\n"
  );
}

/** Formats the verified question, the learner's answer, and the official explanation. */
export function formatFocusPrompt(source: NinaFocusSource) {
  return Arr.join(
    [
      "# Focused Try-out Question",
      "",
      `The learner opened Nina from question ${source.questionOrder} of their finished try-out review.`,
      `- question language: ${source.questionLanguage}`,
      `- learner result: ${source.result}`,
      "",
      "## Question",
      "",
      Str.trim(source.question),
      "",
      source.answer,
      "",
      "## Official Explanation",
      "",
      Str.trim(source.explanation) ||
        "No official explanation in this language.",
    ],
    "\n"
  );
}

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
