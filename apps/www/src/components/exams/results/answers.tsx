import { QueryResult, useQuery } from "@confect/react";
import { useMediaQuery } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentRow } from "@repo/backend/confect/exams/results/contract";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@repo/design-system/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useResultsChoice } from "@/components/exams/results/choice";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { AnswerItem } from "@/components/exams/results/student";
import { EmptyNina } from "@/components/state/empty";

/** The student whose answers the pane shows, as the students' list holds the row. */
type Chosen = typeof StudentRow.Type;

/**
 * The second pane of the results page: the answers of the student the teacher chose in the
 * list. A wide screen keeps it beside the list, saying how to choose a student until one is
 * chosen; a phone opens the answers in a sheet from the bottom once a student is chosen.
 * The panel is laid out by the stylesheet, so the first paint holds it on a wide screen.
 */
export function StudentAnswersPane() {
  const t = useTranslations("Exams");
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);
  const chosen = useResultsChoice((state) => state.chosen);
  const clear = useResultsChoice((state) => state.clear);

  return (
    <>
      <aside
        aria-label={t("results-answers")}
        className="hidden w-96 shrink-0 flex-col border-s lg:flex"
      >
        {chosen === null ? (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyNina act="reading" />
              <EmptyDescription>{t("answers-choose")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <header className="flex min-h-12 shrink-0 flex-col justify-center gap-0.5 border-b px-4 py-2">
              <h2 className="truncate font-medium text-sm">{chosen.name}</h2>
              <ChosenScore chosen={chosen} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {wide ? <ChosenAnswers chosen={chosen} /> : null}
            </div>
          </>
        )}
      </aside>
      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            clear();
          }
        }}
        open={chosen !== null && !wide}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{chosen?.name}</SheetTitle>
            {chosen === null ? null : <ChosenScore chosen={chosen} />}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {chosen === null || wide ? null : <ChosenAnswers chosen={chosen} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The chosen student's score out of the exam's total, once the attempt is scored. */
function ChosenScore({ chosen }: { readonly chosen: Chosen }) {
  const t = useTranslations("Exams");
  const { total } = useResultsPaper();

  return chosen.points === null ? null : (
    <p className="text-muted-foreground text-sm tabular-nums">
      {t("student-score", { points: chosen.points, total })}
    </p>
  );
}

/** Each scored question of the chosen student, with the answer and its verdict. */
function ChosenAnswers({ chosen }: { readonly chosen: Chosen }) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const answers = useQuery(
    exams.results.results.attempt,
    settled ? { attemptId: chosen.attemptId, sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(answers)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("results-unavailable")}
      </p>
    );
  }
  if (!QueryResult.isSuccess(answers)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(answers.value.questions)) {
    return <p className="text-muted-foreground text-sm">{t("answers-none")}</p>;
  }
  return (
    <ul className="grid gap-3 text-sm">
      {Arr.map(answers.value.questions, (question) => (
        <AnswerItem key={question.number} question={question} reader="staff" />
      ))}
    </ul>
  );
}
