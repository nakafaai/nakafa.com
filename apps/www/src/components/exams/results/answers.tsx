import { QueryResult, useQuery } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { AttemptResult } from "@repo/backend/confect/exams/results/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr, Number as Num } from "effect";
import { useTranslations } from "use-intl";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { GradeField } from "@/components/exams/results/grade";
import { responseText, verdictKeys } from "@/components/exams/results/model";
import { useResultsSelection } from "@/components/exams/results/selection";

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

/** The chosen student's answers, read once the student is chosen: a sentence before the submit. */
function AttemptAnswers({
  attemptId,
  onClose,
}: {
  readonly attemptId: Parameters<typeof GradeField>[0]["answer"]["attemptId"];
  readonly onClose: () => void;
}) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const read = useQuery(
    exams.results.results.attempt,
    settled ? { attemptId, sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(read)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("results-unavailable")}
      </p>
    );
  }
  if (!QueryResult.isSuccess(read)) {
    return null;
  }
  const result = read.value;
  const total =
    result === null
      ? 0
      : Num.sumAll(Arr.map(result.questions, (question) => question.points));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{result?.name ?? ""}</p>
          {result === null ? null : (
            <p className="text-muted-foreground text-sm tabular-nums">
              {t("student-score", { points: result.points, total })}
            </p>
          )}
        </div>
        <Button
          aria-label={tCommon("close")}
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
      </div>
      {result === null ? (
        <p className="text-sm">{t("results-not-submitted")}</p>
      ) : (
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
      )}
    </div>
  );
}

/**
 * The chosen student's answers beside the students' list (two panes): a pane along the page's right
 * edge on a wide screen, beside the list it leaves in view, and a sheet on a phone, as the proctor's
 * seat panel and the exam editor's panel are. A viewer who grades gives each answer its points here.
 * The pane stays closed until a student is chosen.
 */
export function StudentAnswersPanel() {
  const t = useTranslations("Exams");
  const selected = useResultsSelection((state) => state.selected);
  const choose = useResultsSelection((state) => state.choose);
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);

  if (isDesktop) {
    if (selected === null) {
      return null;
    }
    return (
      <aside
        aria-label={t("results-student-answers")}
        className="w-96 shrink-0 overflow-y-auto border-s p-4"
      >
        <AttemptAnswers attemptId={selected} onClose={() => choose(null)} />
      </aside>
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          choose(null);
        }
      }}
      open={selected !== null}
    >
      <SheetPopup side="bottom">
        <SheetHeader>
          <SheetTitle>{t("results-student-answers")}</SheetTitle>
        </SheetHeader>
        {selected === null ? null : (
          <div className="overflow-y-auto px-4 pb-4">
            <AttemptAnswers attemptId={selected} onClose={() => choose(null)} />
          </div>
        )}
      </SheetPopup>
    </Sheet>
  );
}
