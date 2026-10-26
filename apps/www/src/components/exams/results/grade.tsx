import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  AnswerRow,
  QuestionSummary,
} from "@repo/backend/confect/exams/results/contract";
import { Input } from "@repo/design-system/components/ui/input";
import { Function as Fn, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useResultsScope } from "@/components/exams/results/context";
import { gradedAttempt, gradedPage } from "@/components/exams/results/graded";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";

/**
 * The points a teacher gives one answer, as a teacher writes a mark beside an answer on a paper: a whole
 * number from none to the question's points, saved when the teacher leaves the field or presses Enter.
 * The answer shows its points and verdict at once, and both roll back when the server refuses the grade.
 * A number outside the range, or one the teacher did not change, saves nothing.
 */
export function GradeField({
  answer,
  question,
}: {
  readonly answer: Pick<typeof AnswerRow.Type, "attemptId" | "name" | "points">;
  readonly question: Pick<typeof QuestionSummary.Type, "id" | "points">;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const grade = useMutation(exams.results.results.grade).withOptimisticUpdate(
    (localStore, args) => {
      for (const query of localStore.getAllQueries(
        exams.results.results.attempt
      )) {
        if (
          Option.isSome(query.value) &&
          query.value.value !== null &&
          query.args.attemptId === args.attemptId
        ) {
          localStore.setQuery(
            exams.results.results.attempt,
            query.args,
            Option.some(
              gradedAttempt(query.value.value, {
                points: args.points,
                questionId: args.questionId,
              })
            )
          );
        }
      }
      for (const query of localStore.getAllQueries(
        exams.results.results.byQuestion
      )) {
        if (
          Option.isSome(query.value) &&
          query.args.questionId === args.questionId
        ) {
          localStore.setQuery(
            exams.results.results.byQuestion,
            query.args,
            Option.some({
              ...query.value.value,
              page: gradedPage(query.value.value.page, {
                attemptId: args.attemptId,
                points: args.points,
                weight: question.points,
              }),
            })
          );
        }
      }
    }
  );
  // The number the teacher types, which stands for the saved points until the field is left.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft === null ? Number.NaN : Number(draft);
    setDraft(null);
    if (
      next === answer.points ||
      !Number.isInteger(next) ||
      next < 0 ||
      next > question.points
    ) {
      return;
    }
    runExamAction(
      sentAction(() =>
        grade({
          attemptId: answer.attemptId,
          points: next,
          questionId: question.id,
          sittingId,
          slug,
        })
      ),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return (
    <Input
      aria-label={t("grade-of", { name: answer.name })}
      className="w-20 text-right"
      inputMode="numeric"
      onBlur={commit}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      placeholder="0"
      value={draft ?? String(answer.points)}
    />
  );
}
