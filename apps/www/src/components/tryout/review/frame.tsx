import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { cn } from "cn";
import { Array as Arr, type Option, Result } from "effect";
import { type ComponentProps, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { PlayerFooter } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerViewSwitch } from "@/components/player/view";
import { PaneHeader } from "@/components/shared/pane";
import { PaneEdge } from "@/components/shared/panes/edge";
import { paneSideVariants } from "@/components/shared/panes/side";
import { joinTryoutBodies } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import {
  createExplainedStore,
  TryoutExplainedContext,
  TryoutReviewContext,
} from "@/components/tryout/review/context";
import { readsWhole } from "@/components/tryout/review/model";
import {
  TryoutResult,
  TryoutResultFooter,
  TryoutReviewOpener,
} from "@/components/tryout/review/result";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { useFactsWaiting } from "@/components/tryout/section/summary";
import { KEPT_PANE_SCRIPT } from "@/components/tryout/set/kept";
import { useKeptFinished } from "@/components/tryout/set/name";

/**
 * A finished attempt's page, in the player that ran it: its header, the questions it reviews in the list or
 * one at a time, the result in the pane at the screen's right from the large breakpoint, and the footer with
 * previous, next and, below that breakpoint, the result's sheet. The address names the current question, so
 * a reload opens it again. A reader who may not read the section whole has no question to move through: the
 * page shows its preview under the Pro offer, and the result holds the numbers alone.
 *
 * The page read sends the bodies with the runtime, so a question without its body is a broken read, which
 * the route's error boundary shows with Retry and reports, never a review without its questions.
 */
export function TryoutReviewFrame({
  children,
  header,
  limit,
  mode,
  runtime,
  score,
}: {
  /** The questions the review shows, in the player's column. */
  children: ReactNode;
  /** The page's header, which the view of the questions joins. */
  header: ReactNode;
  /** The section's time limit, in seconds. */
  limit: Option.Option<number>;
  /** The view the browser resolved for the page. */
  mode: PlayerMode;
  runtime: TryoutSectionRuntime;
  score: TryoutScoreResult;
}) {
  const t = useTranslations("Tryouts");
  const bodies = use(TryoutContentContext)?.bodies ?? [];
  const joined = Result.getOrThrow(joinTryoutBodies(bodies, runtime.questions));
  const whole = readsWhole(Arr.map(joined, ({ body }) => body));
  const [explained] = useState(createExplainedStore);

  return (
    <TryoutReviewContext value={{ joined, limit, runtime, score, whole }}>
      <TryoutExplainedContext value={explained}>
        <PlayerProvider
          address
          // A reader who takes Pro on the page reads the section whole once its read comes back, so the
          // player starts again with every question to move through.
          key={whole ? "whole" : "preview"}
          keys={
            whole
              ? Arr.map(runtime.questions, (question) => question.placementId)
              : []
          }
          mode={mode}
          review
        >
          <PlayerKeys locked questions={[]} />
          {header}
          <PlayerMain
            label={t("finished-panel")}
            navigator={
              <PlayerSidebar
                footer={whole ? <TryoutResultFooter /> : undefined}
                title={t("finished-panel")}
              >
                <TryoutResult />
              </PlayerSidebar>
            }
          >
            {children}
          </PlayerMain>
          <PlayerFooter>
            <TryoutReviewOpener />
          </PlayerFooter>
          <PlayerSheet
            description={t("finished-panel-description")}
            footer={whole ? <TryoutResultFooter /> : undefined}
            title={t("finished-panel")}
          >
            <TryoutResult />
          </PlayerSheet>
        </PlayerProvider>
      </TryoutExplainedContext>
    </TryoutReviewContext>
  );
}

/**
 * The view of a review's questions, for a page header that a review and the section page share: it shows in a
 * review's frame, and nowhere else, since only a review has questions to lay out.
 */
export function TryoutReviewView() {
  return use(TryoutReviewContext) === null ? null : <PlayerViewSwitch />;
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
