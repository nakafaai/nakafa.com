import {
  Cancel01Icon,
  HourglassIcon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { Grade } from "@repo/backend/confect/assessment/grade";
import type {
  QuestionGrade,
  QuestionResponse,
} from "@repo/backend/confect/assessment/parts";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import {
  chosenOptions,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import { partDirection, partLetter } from "@repo/backend/confect/exams/letters";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/deferred";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  LineMark,
  LineWords,
  MarkedLine,
} from "@repo/design-system/components/ui/line";
import { Array as Arr, Option, String as Str } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { ChoiceReviewed } from "@/components/player/choice";
import { ChoiceTable } from "@/components/player/table";
import type { Entry } from "@/components/tryout/runtime/response/entry";
import {
  decimalOf,
  gradedMark,
  isEntry,
  reviewEntry,
} from "@/components/tryout/runtime/response/entry";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { optionLabelId } from "@/components/tryout/runtime/response/id";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";
import {
  onlyResponse,
  reviewedParts,
} from "@/components/tryout/runtime/response/parts";

/** The mark of the learner's typed answer: a check once it earns the key, a cross when it misses, a dash while blank. */
const ENTRY_MARK = {
  correct: Tick02Icon,
  idle: MinusSignIcon,
  wrong: Cancel01Icon,
} as const;

/** How a formula the server grades reads (`gradedMark`): its line's tone, its mark, and the verdict it says. */
const GRADED_LINE = {
  blank: { icon: MinusSignIcon, tone: "idle", verdict: "unanswered" },
  correct: { icon: Tick02Icon, tone: "correct", verdict: "correct" },
  pending: { icon: HourglassIcon, tone: "idle", verdict: "pending" },
  wrong: { icon: Cancel01Icon, tone: "wrong", verdict: "incorrect" },
} as const;

/**
 * The learner's answer to a reviewed question. A question of one interaction shows its fields marked against the
 * key when the reader may see it (`TryoutReviewedFields`), and read only otherwise. A question of several shows each
 * part under its label with the points it earned (`TryoutReviewedParts`).
 */
export function TryoutReviewedAnswer({
  grade,
  id,
  interactions,
  keys,
  response,
}: {
  /** How the answer graded, when the reader may see it. */
  readonly grade: QuestionGrade | undefined;
  readonly id: string;
  readonly interactions: readonly [Interaction, ...Interaction[]];
  /** The key's answer for each interaction, when the reader may see them. */
  readonly keys: readonly InteractionKey[] | undefined;
  readonly response: QuestionResponse | null;
}) {
  const [only, ...later] = interactions;
  if (Arr.isReadonlyArrayNonEmpty(later)) {
    return (
      <TryoutReviewedParts
        grade={grade}
        id={id}
        interactions={interactions}
        keys={keys}
        response={response}
      />
    );
  }
  const answer = keys?.[0];
  return answer === undefined ? (
    <TryoutResponseFields
      value={{
        id,
        interaction: only,
        locked: true,
        onChange: () => undefined,
        response: onlyResponse(response),
      }}
    />
  ) : (
    <TryoutReviewedFields
      answer={answer}
      grade={Option.fromUndefinedOr(grade)}
      id={id}
      interaction={only}
      response={onlyResponse(response)}
    />
  );
}

/**
 * Each part of a reviewed question of several, in the item's order, as a result lists a paper's answers: the part's
 * label with the points it earned, or that it waits for its grade, and the learner's answer, marked against the
 * part's key when the reader may see it and read only otherwise.
 */
function TryoutReviewedParts({
  grade,
  id,
  interactions,
  keys,
  response,
}: {
  readonly grade: QuestionGrade | undefined;
  readonly id: string;
  readonly interactions: readonly Interaction[];
  readonly keys: readonly InteractionKey[] | undefined;
  readonly response: QuestionResponse | null;
}) {
  return (
    <ul className="grid gap-3">
      {Arr.map(
        reviewedParts({ grade, interactions, keys, response }),
        (part) => {
          const partId = `${id}-${part.interaction.id}`;
          return (
            <li
              className="grid gap-2 border-b pb-3 last:border-b-0"
              key={part.interaction.id}
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">{part.interaction.label}</span>
                {Option.match(part.grade, {
                  onNone: () => null,
                  onSome: (graded) => <TryoutPartPoints grade={graded} />,
                })}
              </div>
              {Option.match(part.key, {
                onNone: () => (
                  <TryoutResponseFields
                    value={{
                      id: partId,
                      interaction: part.interaction,
                      label: part.interaction.label,
                      locked: true,
                      onChange: () => undefined,
                      response: part.response,
                    }}
                  />
                ),
                onSome: (answer) => (
                  <TryoutReviewedFields
                    answer={answer}
                    grade={part.grade}
                    id={partId}
                    interaction={part.interaction}
                    response={part.response}
                  />
                ),
              })}
            </li>
          );
        }
      )}
    </ul>
  );
}

/** The points one part earned out of its own, or that it waits for its grade. */
function TryoutPartPoints({ grade }: { readonly grade: Grade }) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");

  return grade.status === "pending" ? (
    <span className="text-muted-foreground">
      {t("verdict", { state: "pending" })}
    </span>
  ) : (
    <span className="tabular-nums">
      {`${grade.category} / ${grade.ceiling} ${tCommon("score-points")}`}
    </span>
  );
}

/**
 * Renders one interaction of a reviewed question with its key: each option marked correct or not,
 * each statement of a matrix with the key's column and a mark that misses it, a short answer or a number
 * marked against the answers its key accepts, a formula marked by its grade beside the key's formula, and an
 * essay as the learner wrote it, since its points read beside it.
 */
function TryoutReviewedFields({
  answer,
  grade,
  id,
  interaction,
  response,
}: {
  /** The key's answer for the interaction. */
  readonly answer: InteractionKey;
  /** How the answer graded, which marks a formula, when the reader may see it. */
  readonly grade: Option.Option<Grade>;
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
  if (interaction.kind === "mathEntry") {
    return (
      <TryoutReviewedFormula
        answer={answer}
        mark={gradedMark(response, grade)}
        response={response}
      />
    );
  }
  if (interaction.kind === "extendedText") {
    return <TryoutReviewedEssay response={response} />;
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
  const player = useTranslations("Player");
  const format = useFormatter();
  const review = reviewEntry({
    decimal: decimalOf(format.number),
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
            {player(review.earned ? "correct" : "incorrect")}
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
            {format.list(review.accepted, "or")}
          </LineWords>
        </MarkedLine>
      )}
    </div>
  );
}

/**
 * A formula under its key, which the server grades: the learner's line, marked by its grade (`gradedMark`), and
 * under a line that is not correct, the key's formula in the key's tone.
 */
function TryoutReviewedFormula({
  answer,
  mark,
  response,
}: {
  readonly answer: InteractionKey;
  readonly mark: keyof typeof GRADED_LINE;
  readonly response: ExamResponse | null;
}) {
  const t = useTranslations("Tryouts");
  const line = GRADED_LINE[mark];
  return (
    <div className="grid gap-2">
      <MarkedLine tone={line.tone}>
        <LineMark>
          <HugeIcons icon={line.icon} />
        </LineMark>
        <LineWords dir="ltr">
          <span className="sr-only">{t("your-answer")}: </span>
          {mark === "blank"
            ? t("no-answer")
            : typedText(response ?? NO_RESPONSE)}
          <span className="sr-only">
            {" "}
            {t("verdict", { state: line.verdict })}
          </span>
        </LineWords>
      </MarkedLine>
      {mark === "correct" || answer.kind !== "mathEntry" ? null : (
        <MarkedLine tone="key">
          <LineMark>
            <HugeIcons icon={Tick02Icon} />
          </LineMark>
          <LineWords dir="ltr">
            <span className="sr-only">{t("correct-answer")}: </span>
            <InlineMath math={answer.expression} />
          </LineWords>
        </MarkedLine>
      )}
    </div>
  );
}

/** An essay as the learner wrote it, with its formulas and lists, or that it has no answer. */
function TryoutReviewedEssay({
  response,
}: {
  readonly response: ExamResponse | null;
}) {
  const t = useTranslations("Tryouts");
  const text = typedText(response ?? NO_RESPONSE);
  return Str.isEmpty(Str.trim(text)) ? (
    <p className="text-muted-foreground text-sm">{t("no-answer")}</p>
  ) : (
    <DeferredLearnerText>{text}</DeferredLearnerText>
  );
}
