import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "cn";
import { Array as Arr, Result } from "effect";
import { type ComponentProps, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import { splitTime } from "@/components/player/time";
import { pageRowVariants } from "@/components/shared/content/width";
import { PaneBody, PaneHeader } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/panes";
import { PaneEdge } from "@/components/shared/panes/edge";
import { paneSideVariants } from "@/components/shared/panes/side";
import { joinTryoutBodies } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { useFactsWaiting } from "@/components/tryout/section/summary";
import { KEPT_PANE_SCRIPT } from "@/components/tryout/set/kept";
import { useKeptFinished } from "@/components/tryout/set/name";

/**
 * A finished attempt's page: what it reviews in the page's frame, and its result in the pane at the
 * screen's right, from the window's top to its bottom. On a phone the result opens in a sheet.
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
      <Panes id="tryout-finished">
        <PanesList>
          <div className={cn(pageRowVariants(), "space-y-6 py-6")}>
            <TryoutFinishedOpen />
            {children}
          </div>
        </PanesList>
        <PanesDetail alwaysOn label={t("finished-panel")}>
          <PaneHeader title={t("finished-panel")} />
          {panel}
        </PanesDetail>
      </Panes>
    </PanesProvider>
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
      className="w-full lg:hidden"
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
 * The result pane of a finished attempt: its numbers, the `children`, then the seats of the paper it
 * reviews. A set of parts has no paper of its own, so its pane holds the numbers alone. The numbers stand
 * in the body, not the footer: three labelled values cannot share one 64px row at the pane's narrowest.
 */
export function TryoutFinishedPanel({
  children,
  runtime,
}: {
  children: ReactNode;
  readonly runtime: TryoutSectionRuntime | null;
}) {
  return (
    <PaneBody>
      <div className="space-y-6">
        {children}
        {runtime === null ? null : <TryoutReviewSeats runtime={runtime} />}
      </div>
    </PaneBody>
  );
}

/**
 * The result pane's place while a learner's read has not answered. The page narrows beside a pane, so a
 * page this browser last read as finished stands an empty pane there from the first frame, under the
 * title the pane will carry, and nothing moves when the pane arrives. A first visit has nothing to draw.
 */
export function TryoutFinishedPlace({ pending }: { pending: boolean }) {
  const t = useTranslations("Tryouts");
  const waiting = useFactsWaiting(pending);
  const finished = useKeptFinished();
  if (!waiting) {
    return null;
  }
  return (
    <aside
      aria-hidden
      className={cn(paneSideVariants({ from: "lg" }), "data-empty:hidden")}
      data-empty={finished ? undefined : ""}
      data-pane-side={finished ? "lg" : undefined}
      inert
    >
      <PaneEdge resizer={STILL_EDGE} />
      <PaneHeader title={t("finished-panel")} />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only
        dangerouslySetInnerHTML={{ __html: KEPT_PANE_SCRIPT }}
        suppressHydrationWarning
      />
    </aside>
  );
}

/** The edge a place draws, which no press moves: the pane that replaces it carries the live one. */
const STILL_EDGE: ComponentProps<typeof PaneEdge>["resizer"] = {
  "aria-orientation": "vertical",
  "aria-valuemax": 768,
  "aria-valuemin": 320,
  "aria-valuenow": 420,
  onKeyDown: () => undefined,
  onLostPointerCapture: () => undefined,
  onPointerCancel: () => undefined,
  onPointerDown: () => undefined,
  onPointerMove: () => undefined,
  onPointerUp: () => undefined,
};

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
