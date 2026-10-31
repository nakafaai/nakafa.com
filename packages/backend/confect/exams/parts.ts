import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  keyMissing,
  type QuestionView,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Match, Option, Schema, String as Str } from "effect";

/** The label of an option, a statement, a column or an answer: a rich document of its own. */
type PartLabel = typeof ContentDocumentSchema.Type;

/**
 * Whether a label shows nothing: each of its blocks is a paragraph that holds only spaces and line breaks, as
 * a new option holds until the teacher writes it. A formula, a picture, a list or any other block shows
 * something, so a label that holds one is never empty.
 */
export const labelEmpty = (label: PartLabel) =>
  Arr.every(
    label.content,
    (block) =>
      block.type === "paragraph" &&
      Arr.every(
        block.content ?? [],
        (node) =>
          node.type === "hardBreak" ||
          (node.type === "text" && Str.isEmpty(Str.trim(node.text)))
      )
  );

/** The labels a student reads in one interaction: its options, its statements and columns, or both sides of its pairs. */
const partLabels = (answer: Interaction): readonly PartLabel[] =>
  Match.value(answer).pipe(
    Match.when({ kind: "choice" }, (choice) =>
      Arr.map(choice.options, (option) => option.label)
    ),
    Match.when({ kind: "matrix" }, (table) =>
      Arr.map([...table.statements, ...table.columns], (part) => part.label)
    ),
    Match.when({ kind: "match" }, (match) =>
      Arr.map([...match.sources, ...match.targets], (part) => part.label)
    ),
    Match.orElse(() => [])
  );

/** Whether any part of a question's interactions shows nothing, which keeps its exam from being scheduled. */
export const partsEmpty = (answers: readonly Interaction[]) =>
  Arr.some(answers, (answer) => Arr.some(partLabels(answer), labelEmpty));

/** The parts of one list that show something, in their order. */
const filled = <Part extends { readonly label: PartLabel }>(
  parts: readonly Part[]
) => Arr.filter(parts, (part) => !labelEmpty(part.label));

/**
 * The interactions as a student's paper shows them: every option, statement and answer that shows nothing is
 * left out, and a table or a matching left with no statement, or with no answer, is left out whole, so a
 * student never meets an empty answer. A table keeps its two columns, which no student picks alone. The
 * schedule refuses an exam with an empty part (`questionGap`), so the paper of a scheduled exam leaves out
 * only a part that was emptied after the schedule. The stored interactions keep every part with its ID, so a
 * response to a part the paper shows still fits the question.
 */
export const paperAnswers = (
  answers: readonly Interaction[]
): readonly Interaction[] =>
  Arr.getSomes(
    Arr.map(answers, (answer) =>
      Match.value(answer).pipe(
        Match.when({ kind: "choice" }, (choice) =>
          Option.some<Interaction>({
            ...choice,
            options: filled(choice.options),
          })
        ),
        Match.when({ kind: "matrix" }, (table) =>
          Arr.match(filled(table.statements), {
            onEmpty: () => Option.none<Interaction>(),
            onNonEmpty: (statements) =>
              Option.some<Interaction>({ ...table, statements }),
          })
        ),
        Match.when({ kind: "match" }, (match) =>
          Option.zipWith(
            Arr.match(filled(match.sources), {
              onEmpty: () => Option.none(),
              onNonEmpty: Option.some,
            }),
            Arr.match(filled(match.targets), {
              onEmpty: () => Option.none(),
              onNonEmpty: Option.some,
            }),
            (sources, targets): Interaction => ({ ...match, sources, targets })
          )
        ),
        Match.orElse((other) => Option.some(other))
      )
    )
  );

/** Why a question keeps its exam from being scheduled: a part that shows nothing, or a key it needs and lacks. */
export const QuestionGap = Schema.Literals(["empty", "key"]);
export type QuestionGap = typeof QuestionGap.Type;

/**
 * What keeps a question from being sat, or none when it is ready: a part that shows nothing first, since the
 * teacher writes the options before marking the correct one, then a key that it needs and lacks
 * (`keyMissing`). The schedule refuses a question with a gap, and the editor and the schedule dialog name it
 * before the teacher asks.
 */
export const questionGap = (
  question: Pick<QuestionView, "answers" | "key" | "template">
): Option.Option<QuestionGap> => {
  if (partsEmpty(question.answers)) {
    return Option.some("empty");
  }
  return keyMissing(question) ? Option.some("key") : Option.none();
};
