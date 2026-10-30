import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  needsKey,
  QUESTION_POINTS_MAX,
  takesRubric,
} from "@repo/backend/confect/exams/question";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { fieldBoxVariants } from "@repo/design-system/lib/input";
import type { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Function as Fn, Option, Schema } from "effect";
import { lazy, type ReactNode, Suspense, useId, useState } from "react";
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
 * The points of a question: the design system's number field, a whole number from one to the bound
 * that the steppers and the arrow keys move, saved once the teacher commits it (a step, Enter, or
 * leaving the field). The stored value is shown at once and rolls back when the server refuses the
 * change. A value the teacher did not change saves nothing.
 */
function PointsField({ editable, points, questionId }: PointsFieldProps) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const id = useId();
  const save = useMutation(exams.questions.points).withOptimisticUpdate(
    pointsUpdate
  );
  // The number the teacher types or steps to, which stands for the stored points until it is committed.
  const [draft, setDraft] = useState<Option.Option<number | null>>(Option.none);

  const commit = (next: number | null) => {
    setDraft(Option.none());
    if (next === null || next === points || !Number.isInteger(next)) {
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
      <NumberField
        className="w-32"
        disabled={!editable}
        format={{ maximumFractionDigits: 0 }}
        id={id}
        max={QUESTION_POINTS_MAX}
        min={1}
        onValueChange={(next) => setDraft(Option.some(next))}
        onValueCommitted={commit}
        step={1}
        value={Option.getOrElse(draft, () => points)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
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
 * The teacher's layer of a question, in the editor's panel beside the canvas, in three parts a rule
 * divides: the points, the answer key in the editor of its type (the marked options, the accepted
 * answers of a short answer, the pairs of a match; a table marks its key in its rows), and the notes, the rubric
 * when the question's template takes one (`takesRubric`) and the explanation. The paper on the canvas is what the student reads, so the
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
  // A table's key is marked in its rows on the canvas, so the panel holds no key part for it.
  const keyed = needsKey(shown.template) && shown.template !== "table";

  return (
    <FieldGroup>
      <PointsField
        editable={editable}
        points={question.points}
        questionId={question.id}
      />
      <FieldSeparator />
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
      {keyed && shown.template !== "short" && shown.template !== "match" ? (
        <AnswerKey
          editable={editable}
          marked={markedOptions(shown.key)}
          multiple={shown.template === "choices"}
          number={number}
          onMark={editing.markOption}
          options={options}
        />
      ) : null}
      {keyed ? <FieldSeparator /> : null}
      {takesRubric(shown.template) ? (
        <NoteField title={t("rubric")}>
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
        </NoteField>
      ) : null}
      <NoteField title={t("explanation")}>
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
      </NoteField>
    </FieldGroup>
  );
}

/**
 * A note of the teacher's layer, the rubric or the explanation: its title over its rich text, framed as
 * a text field is, so an empty note still reads as a place to write.
 */
function NoteField({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Field>
      <FieldTitle>{title}</FieldTitle>
      <div
        className={cn(
          fieldBoxVariants(),
          "block h-auto min-h-16 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        )}
      >
        {children}
      </div>
    </Field>
  );
}
