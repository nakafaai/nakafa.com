import {
  FullScreenIcon,
  GridViewIcon,
  Layout01Icon,
} from "@hugeicons/core-free-icons";
import { useReducedMotion } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr, Data, Effect, Option } from "effect";
import { type RefObject, useState, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import { contentWidthVariants } from "@/components/shared/content/width";
import { PageCounter } from "@/components/tenant/exams/counter";
import type { Question } from "@/components/tenant/exams/optimistic";
import { ExamPanelButton } from "@/components/tenant/exams/panel";
import { ZoomMenu } from "@/components/tenant/exams/percent";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import { QuestionPreview } from "@/components/tenant/exams/preview";
import {
  useActiveQuestion,
  useEditorView,
  useExam,
  useExamSelection,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import {
  drawnZoom,
  sliderPosition,
  ZOOM_STEPS,
  zoomAt,
} from "@/components/tenant/exams/zoom";
import { reportClientException } from "@/lib/analytics/client";

/** Subscribes to the browser's fullscreen changes, which the teacher may also make with the browser's own keys. */
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
  };
};

/** Whether the browser shows some element fullscreen. */
const isFullscreen = () => document.fullscreenElement !== null;

/** Whether the browser allows fullscreen for this page, which iPhone Safari does not for an element. */
const canGoFullscreen = () => document.fullscreenEnabled;

/** The server's answer for fullscreen: none, since the browser answers only in the browser. */
const noFullscreen = () => false;

/** Where the footer reports a fullscreen request that the browser refused. */
const SOURCE = "components/tenant/exams/footer";

/**
 * The server cannot ask the browser, so it draws the fullscreen control as a desktop browser allows it.
 * A browser that refuses fullscreen disables the control once the page loads, and the control keeps its place.
 */
const fullscreenOnServer = () => true;

/** The browser refused a request to enter or leave fullscreen, such as one without a gesture. */
class FullscreenRefused extends Data.TaggedError("FullscreenRefused")<{
  readonly cause: unknown;
}> {}

/** The props of the footer of the editor: the canvas it moves, and the zoom change it hands to the editor. */
interface ExamFooterProps {
  readonly canvas: RefObject<HTMLElement | null>;
  readonly onZoom: (percent: number) => void;
}

/**
 * The footer of the editor, a full-width bar under the canvas, as a design tool keeps its navigation
 * there, its row at the page width of the editor's panes: on a phone, the action that opens the teacher's
 * panel at its start; then at its end the zoom (on
 * a wide screen only, since a phone pinches) as a slider and a percentage menu, a toggle for a strip of the
 * pages, the position of the page in view that jumps to a page, the grid of every page in place of the
 * canvas, and fullscreen where the browser allows it. In the grid the footer keeps only the grid and
 * fullscreen. Each icon names its action in a tooltip. The strip, the counter, and the grid go to a page,
 * and the page they choose becomes the one the teacher is on.
 */
export function ExamFooter({ canvas, onZoom }: ExamFooterProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const active = useActiveQuestion();
  const pin = useExamSelection((state) => state.pin);
  const drawn = useExamZoom(drawnZoom);
  const grid = useEditorView((view) => view.mode === "grid");
  const toggleGrid = useEditorView((view) => view.toggleGrid);
  const reduce = useReducedMotion();
  const [pagesOpen, setPagesOpen] = useState(false);
  const canFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    canGoFullscreen,
    fullscreenOnServer
  );
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    isFullscreen,
    noFullscreen
  );
  const total = exam.questions.length;
  const current = Option.getOrElse(
    Option.map(active, (page) => page.index + 1),
    () => 0
  );
  const selectedId = Option.getOrNull(
    Option.map(active, (page) => page.question.id)
  );

  /**
   * Scrolls the canvas to a page, and holds the page as the one the teacher is on until the teacher
   * scrolls by hand. The hold lets a page at the end of the exam stay chosen, though the scroll cannot
   * bring it to the top of the canvas.
   */
  const goTo = (question: Question) => {
    const root = canvas.current;
    const page = document.getElementById(`question-${question.id}`);
    if (root !== null && page !== null) {
      root.scrollTo({
        behavior: reduce ? "auto" : "smooth",
        top:
          root.scrollTop +
          page.getBoundingClientRect().top -
          root.getBoundingClientRect().top,
      });
    }
    pin(question.id);
  };

  /**
   * Toggles the fullscreen of the whole page, where the browser allows it. The page goes fullscreen
   * rather than the editor alone, because the browser draws only the fullscreen element's own tree,
   * and the dialogs, sheets, and menus of the editor open at the end of the document. Escape leaves it,
   * as the browser lets it.
   */
  const toggleFullscreen = () => {
    if (document.fullscreenElement !== null) {
      Effect.runFork(
        Effect.tryPromise({
          try: () => document.exitFullscreen(),
          catch: (cause) => new FullscreenRefused({ cause }),
        }).pipe(
          Effect.catchTag("FullscreenRefused", (error) =>
            reportClientException(error, { source: SOURCE })
          )
        )
      );
      return;
    }
    Effect.runFork(
      Effect.tryPromise({
        try: () => document.documentElement.requestFullscreen(),
        catch: (cause) => new FullscreenRefused({ cause }),
      }).pipe(
        Effect.catchTag("FullscreenRefused", (error) =>
          reportClientException(error, { source: SOURCE })
        )
      )
    );
  };

  return (
    <footer className="flex shrink-0 flex-col border-t bg-background">
      {pagesOpen && !grid ? (
        <div className="border-b">
          <nav
            aria-label={t("pages")}
            className={cn(
              contentWidthVariants({ width: "page" }),
              "flex w-full gap-3 overflow-x-auto p-3"
            )}
          >
            {Arr.map(exam.questions, (question, index) => (
              <PageThumb
                key={question.id}
                number={index + 1}
                onPick={() => goTo(question)}
                question={question}
                selected={selectedId === question.id}
              />
            ))}
          </nav>
        </div>
      ) : null}
      <div
        className={cn(
          contentWidthVariants({ width: "page" }),
          "flex min-h-12 w-full items-center gap-2 px-3 py-1.5"
        )}
      >
        {grid ? null : <ExamPanelButton />}
        <div className="ms-auto flex items-center gap-1">
          {grid ? null : (
            <>
              <div className="hidden items-center gap-1 md:flex">
                <Slider
                  aria-label={t("zoom")}
                  className="w-40"
                  max={ZOOM_STEPS}
                  min={0}
                  onValueChange={(position) => onZoom(zoomAt(position))}
                  step={1}
                  value={sliderPosition(drawn)}
                />
                <ZoomMenu onZoom={onZoom} />
              </div>
              <Button
                aria-pressed={pagesOpen}
                onClick={() => setPagesOpen((open) => !open)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <HugeIcons aria-hidden="true" icon={Layout01Icon} />
                {t("pages")}
              </Button>
              <PageCounter
                current={current}
                onJump={(index) =>
                  Option.match(Arr.get(exam.questions, index), {
                    onNone: () => undefined,
                    onSome: goTo,
                  })
                }
                total={total}
              />
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("grid")}
                  aria-pressed={grid}
                  onClick={toggleGrid}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeIcons aria-hidden="true" icon={GridViewIcon} />
            </TooltipTrigger>
            <TooltipContent>{t("grid")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("fullscreen")}
                  aria-pressed={fullscreen}
                  disabled={!canFullscreen}
                  onClick={toggleFullscreen}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeIcons aria-hidden="true" icon={FullScreenIcon} />
            </TooltipTrigger>
            <TooltipContent>{t("fullscreen")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </footer>
  );
}

/** The frame of a page thumbnail in the strip, one width at every screen width. */
const pageThumb = cva(
  "relative block aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted/40 outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:border-primary aria-[current=true]:ring-2 aria-[current=true]:ring-primary"
);

/** One page as a thumbnail of the strip, which a click goes to. It names its page for assistive technology. */
function PageThumb({
  number,
  onPick,
  question,
  selected,
}: {
  number: number;
  onPick: () => void;
  question: Question;
  selected: boolean;
}) {
  const t = useTranslations("Exams");
  const saved = !isPlaceholderId(question.prompt);

  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={pageThumb()}
      onClick={onPick}
      type="button"
    >
      <span className="sr-only">
        {t("question", { number })}
        {question.key === null ? ` ${t("no-key")}` : null}
      </span>
      <QuestionPreview open={selected} question={question} saved={saved} />
    </button>
  );
}
