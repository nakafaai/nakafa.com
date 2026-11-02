import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import { Array as Arr, Result } from "effect";
import { type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import { splitTime } from "@/components/player/time";
import { pageRowVariants } from "@/components/shared/content/width";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/panes";
import { joinTryoutBodies } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * A finished attempt's page: what it reviews in the first pane, and its result in the second,
 * which runs to the screen's edge at full height. On a phone the result opens in a sheet.
 */
export function TryoutFinishedPanes({
  children,
  panel,
}: {
  children: ReactNode;
  /** The second pane's body and footer, under its header. */
  panel: ReactNode;
}) {
  const t = useTranslations("Tryouts");
  return (
    <PanesProvider wideFrom="lg">
      <TryoutFinishedHeight>
        <Panes fill="parent" id="tryout-finished">
          <PanesList>
            <ScrollArea className="min-h-0 flex-1">
              <div className={cn(pageRowVariants(), "space-y-6 py-6")}>
                <TryoutFinishedOpen />
                {children}
              </div>
            </ScrollArea>
          </PanesList>
          <PanesDetail alwaysOn label={t("finished-panel")}>
            <PaneHeader title={t("finished-panel")} />
            {panel}
          </PanesDetail>
        </Panes>
      </TryoutFinishedHeight>
    </PanesProvider>
  );
}

/**
 * The height the panes take under the page's header. The group takes its parent's height, and a
 * try-out page has only a minimum, so without this the panes would end with their questions.
 */
function TryoutFinishedHeight({ children }: { children: ReactNode }) {
  return (
    <div className="h-[calc(100svh-var(--app-header-top)-4rem)] lg:h-[calc(100svh-4rem)]">
      {children}
    </div>
  );
}

/** Opens the result in its sheet on a phone, where no second pane stands. */
function TryoutFinishedOpen() {
  const t = useTranslations("Tryouts");
  const open = usePanes((state) => state.sheet);
  const showSheet = usePanes((state) => state.showSheet);
  return (
    <Button
      aria-pressed={open}
      className="lg:hidden"
      onClick={showSheet}
      size="sm"
      type="button"
      variant="outline"
    >
      {t("finished-panel")}
    </Button>
  );
}

/**
 * The second pane of a finished attempt: the seats of what it reviews in its body and its numbers,
 * the `children`, in the footer, or its numbers alone in the body of a set of parts, which has no
 * paper of its own.
 */
export function TryoutFinishedPanel({
  children,
  runtime,
}: {
  children: ReactNode;
  readonly runtime: TryoutSectionRuntime | null;
}) {
  if (runtime === null) {
    return <PaneBody>{children}</PaneBody>;
  }
  return (
    <>
      <PaneBody>
        <TryoutReviewSeats runtime={runtime} />
      </PaneBody>
      <PaneFooter>{children}</PaneFooter>
    </>
  );
}

/**
 * A finished attempt's numbers: equal rows of a label and its value, one line each at any width of
 * the pane, so nothing wraps beside something that does not and no value is cut at the edge.
 */
export function TryoutFinishedFacts({
  score,
  seconds,
}: {
  readonly score: TryoutScoreResult;
  /** The time limit, where a page shows one paper's. */
  readonly seconds?: number;
}) {
  const t = useTranslations("Tryouts");
  return (
    <dl className="flex w-full flex-col gap-1.5 text-sm">
      <TryoutFinishedFact
        label={t(
          score.scoreStatus === "provisional"
            ? "score-label-estimated"
            : "score-label-standard"
        )}
      >
        {score.publishedScore}
      </TryoutFinishedFact>
      <TryoutFinishedFact label={t("correct-answers-label")}>
        {score.totalCorrect} / {score.totalQuestions}
      </TryoutFinishedFact>
      {seconds === undefined ? null : (
        <TryoutFinishedFact label={t("part-time-label")}>
          {readClock(seconds)}
        </TryoutFinishedFact>
      )}
    </dl>
  );
}

/** One row of a finished attempt's numbers. */
function TryoutFinishedFact({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 whitespace-nowrap">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** A duration as a clock reads it, such as 01:15:00. */
function readClock(seconds: number) {
  const { hours, minutes, seconds: rest } = splitTime(seconds);
  return Arr.join(
    Arr.map([hours, minutes, rest], (part) => String(part).padStart(2, "0")),
    ":"
  );
}

/**
 * The number seats of a finished paper, as the exam's navigator draws them: a press goes to that
 * question. A question the free preview does not show has nowhere to go, so its seat takes no press.
 */
function TryoutReviewSeats({
  runtime,
}: {
  readonly runtime: TryoutSectionRuntime;
}) {
  const t = useTranslations("Player");
  const value = use(TryoutContentContext);
  const joined = Result.getOrThrow(
    joinTryoutBodies(value?.bodies ?? [], runtime.questions)
  );
  const shown = Arr.takeWhile(joined, ({ body }) => body.key !== undefined);
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(10),1fr))] gap-2">
      {Arr.map(joined, ({ question }, index) => (
        <li key={question.placementId}>
          <Button
            aria-label={t("cell", {
              number: question.questionOrder,
              state: question.response === null ? "unanswered" : "answered",
            })}
            className="w-full"
            disabled={index >= shown.length}
            onClick={() =>
              document
                .querySelector(
                  `#${readQuestionIds(question.questionOrder).article}`
                )
                ?.scrollIntoView()
            }
            size="icon"
            type="button"
            variant={
              question.response === null ? "destructive-outline" : "default"
            }
          >
            {question.questionOrder}
          </Button>
        </li>
      ))}
    </ol>
  );
}
