import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { QUESTION_POINTS_MAX } from "@repo/backend/confect/exams/question";
import {
  Field,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Function as Fn } from "effect";
import { lazy, Suspense, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { isLocked } from "@/components/tenant/exams/freeze";
import {
  pointsUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";

/** The rich texts of the layer load with the page's editors, never with the page. */
const ExamText = lazy(() =>
  import("@/components/tenant/exams/text").then((module) => ({
    default: module.ExamText,
  }))
);

/**
 * The room a rich text takes while its editor is not mounted, so the page keeps its height. A
 * note of the layer takes a line at least, as the editor's own frame does.
 */
function TextRoom() {
  return <div aria-hidden className="min-h-16 rounded-lg bg-background" />;
}

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
        max={QUESTION_POINTS_MAX}
        min={1}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        type="number"
        value={draft ?? String(points)}
      />
    </Field>
  );
}

/** The props of the teacher's layer of one question. */
interface TeacherLayerProps {
  /** Whether the question's editors are mounted, so its fields take changes. */
  readonly live: boolean;
  /** The place of the question in the exam, which names its rich texts for assistive technology. */
  readonly number: number;
  /** The question the layer belongs to. */
  readonly question: Question;
}

/**
 * The teacher's layer of a question, under its paper: the points, then the rubric and the
 * explanation. The paper is what the student reads, so the layer is solid and apart from it, on a
 * muted ground with no dashed line. A layer that is not live shows its room only, and a frozen exam
 * shows its values without changes.
 */
export function TeacherLayer({ live, number, question }: TeacherLayerProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  const editable = live && !frozen;

  return (
    <section
      aria-label={t("teacher-layer")}
      className="grid gap-4 rounded-xl bg-muted p-4 md:p-6"
    >
      <h3 className="font-medium text-sm">{t("teacher-layer")}</h3>
      <PointsField
        editable={editable}
        points={question.points}
        questionId={question.id}
      />
      <div className="grid gap-2">
        <FieldTitle>{t("rubric")}</FieldTitle>
        {live ? (
          <Suspense fallback={<TextRoom />}>
            <ExamText
              documentId={question.rubric}
              key={`${question.rubric}-${frozen}`}
              label={t("rubric-of", { number })}
              placeholder={t("rubric-placeholder")}
              size="line"
            />
          </Suspense>
        ) : (
          <TextRoom />
        )}
      </div>
      <div className="grid gap-2">
        <FieldTitle>{t("explanation")}</FieldTitle>
        {live ? (
          <Suspense fallback={<TextRoom />}>
            <ExamText
              documentId={question.explanation}
              key={`${question.explanation}-${frozen}`}
              label={t("explanation-of", { number })}
              placeholder={t("explanation-placeholder")}
              size="line"
            />
          </Suspense>
        ) : (
          <TextRoom />
        )}
      </div>
    </section>
  );
}
