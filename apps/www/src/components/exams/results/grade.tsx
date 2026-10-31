import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  AnswerRow,
  QuestionSummary,
} from "@repo/backend/confect/exams/results/contract";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { Function as Fn, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useResultsScope } from "@/components/exams/results/context";
import {
  gradedAttempt,
  gradedPage,
  typedPoints,
} from "@/components/exams/results/graded";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";

/**
 * The points a teacher gives one answer, as a teacher writes a mark beside an answer on a paper: a whole
 * number from none to the question's points, saved when the teacher leaves the field or presses Enter.
 * The field names the question's points beside the number, and the answer shows its points and verdict at
 * once, and both roll back when the server refuses the grade. A number outside the range stays in the field,
 * marked, for the teacher to correct, and Escape brings the saved points back.
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

  const typed =
    draft === null ? Option.none() : typedPoints(draft, question.points);

  const commit = () => {
    if (Option.isNone(typed)) {
      return;
    }
    setDraft(null);
    if (typed.value === answer.points) {
      return;
    }
    runExamAction(
      sentAction(() =>
        grade({
          attemptId: answer.attemptId,
          points: typed.value,
          questionId: question.id,
          sittingId,
          slug,
        })
      ),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return (
    <InputGroup className="w-24">
      <InputGroupInput
        aria-invalid={draft !== null && Option.isNone(typed)}
        aria-label={t("grade-of", { name: answer.name })}
        className="text-right tabular-nums"
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(null);
          }
        }}
        placeholder="0"
        value={draft ?? String(answer.points)}
      />
      <InputGroupAddon align="inline-end">/ {question.points}</InputGroupAddon>
    </InputGroup>
  );
}
