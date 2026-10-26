import { QueryResult, useQuery } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { AttemptResult } from "@repo/backend/confect/exams/results/contract";
import { Array as Arr, Number as Num, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { GradeField } from "@/components/exams/results/grade";
import { responseText, verdictKeys } from "@/components/exams/results/model";
import { PaneBody, PaneHeader } from "@/components/shared/pane";
import { PanesDetail, usePanes } from "@/components/shared/panes";

/** Reads the attempt that the open row names. */
const readAttemptId = Schema.decodeUnknownOption(Id("examAttempts"));

/** One question of the chosen student's answers: its number and verdict, its answer, and its points. */
function AnswerItem({
  attemptId,
  name,
  question,
}: {
  readonly attemptId: Parameters<typeof GradeField>[0]["answer"]["attemptId"];
  readonly name: string;
  readonly question: (typeof AttemptResult.Type)["questions"][number];
}) {
  const t = useTranslations("Exams");
  const { canGrade } = useResultsPaper();
  const shown = responseText(question, question.response);

  return (
    <li className="grid gap-2 border-b pb-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">
          {t("question", { number: question.number })}
        </span>
        <span className="text-muted-foreground text-sm">
          {t(verdictKeys[question.verdict])}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">
        {shown === "" ? t("student-no-answer") : shown}
      </p>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{t("results-points")}</span>
        {canGrade ? (
          <GradeField
            answer={{ attemptId, name, points: question.earned }}
            question={question}
          />
        ) : (
          <span className="tabular-nums">{`${question.earned} / ${question.points}`}</span>
        )}
      </div>
    </li>
  );
}

/**
 * The chosen student's answers, read once the student is chosen: the student's name and score in
 * the header, then each answer, or a sentence before the submit.
 */
function AttemptAnswers({
  attemptId,
}: {
  readonly attemptId: Parameters<typeof GradeField>[0]["answer"]["attemptId"];
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const read = useQuery(
    exams.results.results.attempt,
    settled ? { attemptId, sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(read)) {
    return (
      <>
        <PaneHeader title={t("results-student-answers")} />
        <PaneBody>
          <p className="text-muted-foreground text-sm">
            {t("results-unavailable")}
          </p>
        </PaneBody>
      </>
    );
  }
  if (!QueryResult.isSuccess(read)) {
    return null;
  }
  const result = read.value;
  if (result === null) {
    return (
      <>
        <PaneHeader title={t("results-student-answers")} />
        <PaneBody>
          <p className="text-sm">{t("results-not-submitted")}</p>
        </PaneBody>
      </>
    );
  }
  const total = Num.sumAll(
    Arr.map(result.questions, (question) => question.points)
  );

  return (
    <>
      <PaneHeader
        description={t("student-score", { points: result.points, total })}
        title={result.name}
      />
      <PaneBody>
        <ol className="grid gap-3">
          {Arr.map(result.questions, (question) => (
            <AnswerItem
              attemptId={attemptId}
              key={question.id}
              name={result.name}
              question={question}
            />
          ))}
        </ol>
      </PaneBody>
    </>
  );
}

/**
 * The chosen student's answers beside the students' list, in the shared panes: a pane along the
 * list on a wide screen and a sheet on a phone. A viewer who grades gives each answer its points
 * here. The pane says what it shows until a student is chosen.
 */
export function StudentAnswersPanel() {
  const t = useTranslations("Exams");

  return (
    <PanesDetail
      empty={t("results-answers-empty")}
      label={t("results-student-answers")}
    >
      <OpenAttempt />
    </PanesDetail>
  );
}

/** The attempt of the open row, or nothing while no row is open. */
function OpenAttempt() {
  const open = usePanes((state) => state.open);

  return Option.match(Option.flatMap(open, readAttemptId), {
    onNone: () => null,
    onSome: (attemptId) => <AttemptAnswers attemptId={attemptId} />,
  });
}
