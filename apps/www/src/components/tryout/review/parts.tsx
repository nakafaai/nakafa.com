import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { pageRowVariants } from "@/components/shared/page/width";
import { PaneBody, PaneHeader } from "@/components/shared/page/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/page/panes";
import { TryoutPaneOpener } from "@/components/tryout/review/result";

/**
 * A finished attempt of a set of parts: the parts in the page's frame, and the attempt's numbers in the
 * pane at the screen's right from the large breakpoint. Below it the numbers open as a sheet from a bar at
 * the bottom of the screen, which stays in reach while the parts scroll. The page scrolls as a whole, so
 * the bar keeps to the screen's bottom.
 */
export function TryoutPartsResult({
  children,
  facts,
  opener,
}: {
  /** The set's parts. */
  children: ReactNode;
  /** The attempt's numbers, in the pane's body. */
  facts: ReactNode;
  /** What opens the numbers' sheet below the large breakpoint (`TryoutPartsOpener`). */
  opener: ReactNode;
}) {
  const t = useTranslations("Tryouts");

  return (
    <PanesProvider wideFrom="lg">
      <Panes fill="parent" id="tryout-finished">
        <PanesList>
          <div className={cn(pageRowVariants(), "space-y-6 py-6")}>
            {children}
          </div>
        </PanesList>
        <PanesDetail alwaysOn label={t("finished-panel")}>
          <PaneHeader title={t("finished-panel")} />
          <PaneBody>{facts}</PaneBody>
        </PanesDetail>
      </Panes>
      <footer className="bg-background sticky bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        <div
          className={cn(
            pageRowVariants(),
            "flex h-16 items-center justify-center"
          )}
        >
          {opener}
        </div>
      </footer>
    </PanesProvider>
  );
}

/** Opens the numbers of a set of parts in their sheet. */
export function TryoutPartsOpener({ score }: { score: TryoutScoreResult }) {
  const t = useTranslations("Tryouts");
  const showSheet = usePanes((state) => state.showSheet);

  return (
    <TryoutPaneOpener
      count={score.totalCorrect}
      label={t("result-short")}
      name={t("result-open", {
        correct: score.totalCorrect,
        total: score.totalQuestions,
      })}
      onOpen={showSheet}
      total={score.totalQuestions}
    />
  );
}
