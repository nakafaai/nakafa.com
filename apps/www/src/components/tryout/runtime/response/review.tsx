import {
  Cancel01Icon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  chosenOptions,
  type ExamResponse,
  markedCells,
} from "@repo/backend/confect/assessment/response";
import { partDirection, partLetter } from "@repo/backend/confect/exams/letters";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  LineMark,
  LineWords,
  MarkedLine,
} from "@repo/design-system/components/ui/line";
import { Array as Arr, Option } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { ChoiceReviewed } from "@/components/player/choice";
import { ChoiceTable } from "@/components/player/table";
import {
  decimalOf,
  type Entry,
  isEntry,
  reviewEntry,
} from "@/components/tryout/runtime/response/entry";
import { optionLabelId } from "@/components/tryout/runtime/response/id";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";

/** The mark of the learner's typed answer: a check once it earns the key, a cross when it misses, a dash while blank. */
const ENTRY_MARK = {
  correct: Tick02Icon,
  idle: MinusSignIcon,
  wrong: Cancel01Icon,
} as const;

/**
 * Renders the one interaction of a reviewed question with its key: each option marked correct or not,
 * each statement of a matrix with the key's column and a mark that misses it, and a typed answer marked
 * against the answers its key accepts.
 */
export function TryoutReviewedFields({
  answer,
  id,
  interaction,
  response,
}: {
  /** The key's answer for the interaction. */
  readonly answer: InteractionKey;
  readonly id: string;
  readonly interaction: Interaction;
  readonly response: ExamResponse | null;
}) {
  if (interaction.kind === "matrix" && answer.kind === "matrix") {
    const cells = markedCells(response ?? []);
    return (
      <ChoiceTable
        columns={Arr.map(interaction.columns, (column) => ({
          id: column.id,
          label: <TryoutResponseLabel document={column.label} />,
        }))}
        disabled
        statements={Arr.map(interaction.statements, (statement) => ({
          correct: Option.getOrUndefined(
            Option.map(
              Arr.findFirst(
                answer.answers,
                (cell) => cell.statement === statement.id
              ),
              (cell) => cell.column
            )
          ),
          id: statement.id,
          label: (
            <LineWords>
              <TryoutResponseLabel document={statement.label} />
            </LineWords>
          ),
          marked: Option.getOrUndefined(
            Option.map(
              Arr.findFirst(cells, (cell) => cell.statement === statement.id),
              (cell) => cell.column
            )
          ),
        }))}
      />
    );
  }
  if (isEntry(interaction)) {
    return (
      <TryoutReviewedEntry
        answer={answer}
        entry={interaction}
        response={response}
      />
    );
  }
  if (interaction.kind !== "choice" || answer.kind !== "choice") {
    return null;
  }
  const chosen = chosenOptions(response ?? []);
  const parts = interaction.options;
  return (
    <div
      className="grid grid-cols-1 gap-2 md:grid-cols-2"
      dir={partDirection(parts)}
    >
      {Arr.map(interaction.options, (option, index) => {
        const isCorrect = Arr.contains(answer.correct, option.id);
        return (
          <ChoiceReviewed
            checked={Arr.contains(chosen, option.id)}
            id={optionLabelId(id, option.id)}
            isCorrect={isCorrect}
            key={option.id}
            letter={partLetter(parts, index)}
          >
            <TryoutResponseLabel
              correctness={isCorrect}
              document={option.label}
            />
          </ChoiceReviewed>
        );
      })}
    </div>
  );
}

/**
 * A typed answer under its key, in the tones of a reviewed choice: the learner's line, correct once it earns the key,
 * wrong when it misses, open while blank, and under a line that does not earn it, the answers the key accepts in
 * the correct tone. Each line says to a screen reader whose answer it holds and how it went.
 */
function TryoutReviewedEntry({
  answer,
  entry,
  response,
}: {
  readonly answer: InteractionKey;
  readonly entry: Entry;
  readonly response: ExamResponse | null;
}) {
  const t = useTranslations("Tryouts");
  const format = useFormatter();
  const review = reviewEntry({
    decimal: decimalOf(useLocale()),
    entry,
    key: answer,
    response,
  });
  return (
    <div className="grid gap-2">
      <MarkedLine tone={review.tone}>
        <LineMark>
          <HugeIcons icon={ENTRY_MARK[review.tone]} />
        </LineMark>
        <LineWords dir="auto">
          <span className="sr-only">{t("your-answer")}: </span>
          {review.blank ? t("no-answer") : review.text}
          <span className="sr-only">
            {" "}
            {t(review.earned ? "correct" : "incorrect")}
          </span>
        </LineWords>
      </MarkedLine>
      {review.earned ? null : (
        <MarkedLine tone="correct">
          <LineMark>
            <HugeIcons icon={Tick02Icon} />
          </LineMark>
          <LineWords dir="auto">
            <span className="sr-only">{t("correct-answer")}: </span>
            {format.list(review.accepted, { type: "disjunction" })}
          </LineWords>
        </MarkedLine>
      )}
    </div>
  );
}
