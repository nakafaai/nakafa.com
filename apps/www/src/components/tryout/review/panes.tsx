import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import { Array as Arr, Result } from "effect";
import { type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import { pageRowVariants } from "@/components/shared/content/width";
import { PaneBody, PaneHeader } from "@/components/shared/pane";
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

/** Lays out the second pane's body: the seats, when the page reviews questions, then the score. */
export function TryoutFinishedBody({ children }: { children: ReactNode }) {
  return (
    <PaneBody>
      <div className="flex flex-col gap-6">{children}</div>
    </PaneBody>
  );
}

/**
 * The number seats of a finished paper, as the exam's navigator draws them: a press goes to that
 * question. A question the free preview does not show has nowhere to go, so its seat takes no press.
 */
export function TryoutReviewSeats({
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
