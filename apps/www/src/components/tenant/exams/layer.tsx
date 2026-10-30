import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  needsKey,
  QUESTION_POINTS_MAX,
  takesRubric,
} from "@repo/backend/confect/exams/question";
import {
  Field,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import type { Node } from "@tiptap/pm/model";
import { Array as Arr, Function as Fn, Option, Schema } from "effect";
import { lazy, Suspense, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { AcceptedAnswers } from "@/components/tenant/exams/accepted";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  acceptedOf,
  changedOption,
  choiceOf,
  markedOptions,
  optionLetter,
} from "@/components/tenant/exams/answer";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import { isLocked } from "@/components/tenant/exams/freeze";
import { matchOf } from "@/components/tenant/exams/match";
import {
  pointsUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { MatchKey } from "@/components/tenant/exams/pairing";
import { PreviewProse } from "@/components/tenant/exams/preview";
import { useExam, useExamLocked } from "@/components/tenant/exams/provider";
import { ExamDocument } from "@/components/tenant/exams/rich";

/** The rich texts of the layer load with the page's editors, never with the page. */
const ExamText = lazy(() =>
  import("@/components/tenant/exams/text").then((module) => ({
    default: module.ExamText,
  }))
);

/** The props of the points field of one question. */
interface PointsFieldProps {
  /** Whether the teacher may change the points now. */
  readonly editable: boolean;
  /** The points the server holds, which the field shows. */
  readonly points: number;
  /** The question whose points the field sets. */
  readonly questionId: Question["id"];
}

/**
 * The points of a question: a whole number from one to the bound, saved when the teacher leaves the
 * field or presses Enter. The stored value is shown at once and rolls back when the server refuses
 * the change. A value outside the bound, or one the teacher did not change, saves nothing.
 */
function PointsField({ editable, points, questionId }: PointsFieldProps) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const id = useId();
  const save = useMutation(exams.questions.points).withOptimisticUpdate(
    pointsUpdate
  );
  // The text the teacher types, which stands for the stored points until the field changes.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft === null ? Number.NaN : Number(draft);
    setDraft(null);
    if (
      next === points ||
      !Number.isInteger(next) ||
      next < 1 ||
      next > QUESTION_POINTS_MAX
    ) {
      return;
    }
    runExamAction(
      sentAction(() =>
        save({ examId: exam.id, points: next, questionId, slug })
      ),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{t("points")}</FieldLabel>
      <Input
        className="w-24 text-right"
        disabled={!editable}
        id={id}
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder="1"
        value={draft ?? String(points)}
      />
    </Field>
  );
}

/** One option of a question as the key names it: its ID, and the letter the paper shows it by. */
const KeyOption = Schema.Struct({
  /** The ID of the option, which the key marks. */
  id: Schema.String,
  /** The letter that names the option by its place. */
  letter: Schema.String,
});
type KeyOption = typeof KeyOption.Type;

/** The props of the answer key of one question. */
interface AnswerKeyProps {
  /** Whether the teacher may mark the key now. */
  readonly editable: boolean;
  /** The options the key marks correct: one for a single-answer choice, any number for a complex one. */
  readonly marked: readonly string[];
  /** Whether the key marks several options, as a complex choice does. */
  readonly multiple: boolean;
  /** The number of the question, which names each option for assistive technology. */
  readonly number: number;
  /** Marks an option as the key of the question, which saves at once. */
  readonly onMark: (optionId: string) => void;
  /** The options of the question, in the order the paper shows them. */
  readonly options: readonly KeyOption[];
}

/**
 * The answer key of a question: one toggle per option, named by its letter, and the ones the key marks
 * are pressed. A single-answer key chooses one, and choosing the marked option again saves nothing; a
 * complex key presses any number, and each press marks or unmarks one option.
 */
function AnswerKey({
  editable,
  marked,
  multiple,
  number,
  onMark,
  options,
}: AnswerKeyProps) {
  const t = useTranslations("Exams");
  const items = Arr.map(options, (option) => (
    <ToggleGroupItem
      aria-label={t("key-option", { letter: option.letter, number })}
      key={option.id}
      value={option.id}
    >
      {option.letter}
    </ToggleGroupItem>
  ));

  return (
    <Field orientation="horizontal">
      <FieldTitle>{t("answer-key")}</FieldTitle>
      {multiple ? (
        <ToggleGroup
          disabled={!editable}
          onValueChange={(values) =>
            Option.match(changedOption(marked, values), {
              onNone: Fn.constVoid,
              onSome: onMark,
            })
          }
          type="multiple"
          value={marked}
        >
          {items}
        </ToggleGroup>
      ) : (
        <ToggleGroup
          disabled={!editable}
          onValueChange={(value) => {
            if (value !== "") {
              onMark(value);
            }
          }}
          type="single"
          value={Option.getOrElse(Arr.head(marked), () => "")}
        >
          {items}
        </ToggleGroup>
      )}
    </Field>
  );
}

/** The props of the teacher's layer of one question. */
interface TeacherLayerProps {
  /**
   * The edits of the question: the answers, the key and the template the page shows, so the key shows a change
   * at once, and the saves of the key, each of which saves at once.
   */
  readonly editing: QuestionEditing;
  /** Whether the question's editors are mounted, so its fields take changes. */
  readonly live: boolean;
  /** The explanation and the rubric as they are drawn while their editors are not mounted. */
  readonly notes: {
    readonly explanation: Option.Option<Node>;
    readonly rubric: Option.Option<Node>;
  };
  /** The place of the question in the exam, which names its rich texts for assistive technology. */
  readonly number: number;
  /** The question the layer belongs to, as the server holds it. */
  readonly question: Question;
}

/**
 * The teacher's layer of a question, in the editor's panel beside the canvas: the points, the answer
 * key (the marked options, or the accepted answers of a short answer), the rubric when the question's template takes one (`takesRubric`), and the explanation. The paper on the canvas is what the student reads, so the
 * layer stands on its own screen and never on the canvas. Each rich text keeps its height in both
 * states: while its editor is not mounted it is drawn from its document, as the editor draws it. A
 * frozen exam shows its values without changes.
 */
export function TeacherLayer({
  editing,
  live,
  notes,
  number,
  question,
}: TeacherLayerProps) {
  const t = useTranslations("Exams");
  const { displayed: shown } = editing;
  const { exam } = useExam();
  // A text opens anew when its exam locks or unlocks, and takes a lock in place when the exam is gone, so the
  // words on screen stay.
  const frozen = isLocked(exam);
  const locked = useExamLocked();
  const editable = live && !locked;
  const options = Option.match(choiceOf(shown.answers), {
    onNone: (): readonly KeyOption[] => [],
    onSome: (choice) =>
      Arr.map(choice.options, (option, index) => ({
        id: option.id,
        letter: optionLetter(index),
      })),
  });

  return (
    <div className="grid gap-6">
      <PointsField
        editable={editable}
        points={question.points}
        questionId={question.id}
      />
      {shown.template === "short" ? (
        <AcceptedAnswers
          accepted={acceptedOf(shown.key)}
          editable={editable}
          number={number}
          onChange={editing.setAccepted}
        />
      ) : null}
      {Option.match(matchOf(shown.answers), {
        onNone: () => null,
        onSome: (match) => (
          <MatchKey
            editable={editable}
            keyed={shown.key}
            match={match}
            number={number}
            onPair={editing.setPairs}
          />
        ),
      })}
      {needsKey(shown.template) &&
      shown.template !== "short" &&
      shown.template !== "match" &&
      shown.template !== "table" ? (
        <AnswerKey
          editable={editable}
          marked={markedOptions(shown.key)}
          multiple={shown.template === "choices"}
          number={number}
          onMark={editing.markOption}
          options={options}
        />
      ) : null}
      {takesRubric(shown.template) ? (
        <div className="grid gap-2">
          <FieldTitle>{t("rubric")}</FieldTitle>
          {live ? (
            <Suspense
              fallback={<PreviewProse article doc={notes.rubric} size="line" />}
            >
              <ExamText
                documentId={question.rubric}
                key={`${question.rubric}-${frozen}`}
              >
                <ExamDocument
                  label={t("rubric-of", { number })}
                  placeholder={t("rubric-placeholder")}
                  size="line"
                />
              </ExamText>
            </Suspense>
          ) : (
            <PreviewProse article doc={notes.rubric} size="line" />
          )}
        </div>
      ) : null}
      <div className="grid gap-2">
        <FieldTitle>{t("explanation")}</FieldTitle>
        {live ? (
          <Suspense
            fallback={
              <PreviewProse article doc={notes.explanation} size="line" />
            }
          >
            <ExamText
              documentId={question.explanation}
              key={`${question.explanation}-${frozen}`}
            >
              <ExamDocument
                label={t("explanation-of", { number })}
                placeholder={t("explanation-placeholder")}
                size="line"
              />
            </ExamText>
          </Suspense>
        ) : (
          <PreviewProse article doc={notes.explanation} size="line" />
        )}
      </div>
    </div>
  );
}
