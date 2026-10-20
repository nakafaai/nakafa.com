import {
  FullScreenIcon,
  GridViewIcon,
  Layout01Icon,
} from "@hugeicons/core-free-icons";
import { useReducedMotion } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cva } from "class-variance-authority";
import { Array as Arr, Data, Effect, Option } from "effect";
import { type RefObject, useState, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import type { Question } from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import { QuestionPreview } from "@/components/tenant/exams/preview";
import {
  useActiveQuestion,
  useExam,
  useExamSelection,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import {
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
 * The footer of the editor, a full-width bar under the canvas, as a design tool keeps its
 * navigation there: a toggle for a strip of the pages, the position of the page in view, the zoom
 * (on a wide screen only, since a phone pinches), a grid of every page, and fullscreen where the
 * browser allows it. The strip and the grid go to a page, and the page they choose becomes the one
 * the teacher is on.
 */
export function ExamFooter({ canvas, onZoom }: ExamFooterProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const active = useActiveQuestion();
  const pin = useExamSelection((state) => state.pin);
  const zoom = useExamZoom((state) => state.percent);
  const reduce = useReducedMotion();
  const [pagesOpen, setPagesOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const canFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    canGoFullscreen,
    noFullscreen
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
   * and the dialogs, sheets, and menus of the editor open at the end of the document.
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
      {pagesOpen ? (
        <nav
          aria-label={t("pages")}
          className="flex gap-3 overflow-x-auto border-b p-3"
        >
          {Arr.map(exam.questions, (question, index) => (
            <PageThumb
              key={question.id}
              number={index + 1}
              onPick={() => goTo(question)}
              place="strip"
              question={question}
              selected={selectedId === question.id}
            />
          ))}
        </nav>
      ) : null}
      <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
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
        <span className="text-muted-foreground text-sm tabular-nums">
          {current} / {total}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 text-sm md:flex">
            <input
              aria-label={t("zoom")}
              className="w-40 accent-primary"
              max={ZOOM_STEPS}
              min={0}
              onChange={(event) =>
                onZoom(zoomAt(Number(event.currentTarget.value)))
              }
              step={1}
              type="range"
              value={sliderPosition(zoom)}
            />
            <output className="w-12 text-end tabular-nums">{zoom}%</output>
          </div>
          <Button
            aria-label={t("grid")}
            onClick={() => setGridOpen(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={GridViewIcon} />
          </Button>
          {canFullscreen ? (
            <Button
              aria-label={fullscreen ? t("fullscreen-exit") : t("fullscreen")}
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons aria-hidden="true" icon={FullScreenIcon} />
            </Button>
          ) : null}
        </div>
      </div>
      <ResponsiveDialog open={gridOpen} setOpen={setGridOpen} title={t("grid")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Arr.map(exam.questions, (question, index) => (
            <PageThumb
              key={question.id}
              number={index + 1}
              onPick={() => {
                setGridOpen(false);
                goTo(question);
              }}
              place="grid"
              question={question}
              selected={selectedId === question.id}
            />
          ))}
        </div>
      </ResponsiveDialog>
    </footer>
  );
}

/**
 * The frame of a page thumbnail. The strip keeps each thumbnail at one width at every screen width,
 * and the grid's thumbnail fills its cell.
 */
const pageThumb = cva(
  "relative block aspect-4/3 overflow-hidden rounded-lg border bg-muted/40 outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:border-primary aria-[current=true]:ring-2 aria-[current=true]:ring-primary",
  {
    variants: {
      place: {
        grid: "w-full",
        strip: "w-32 shrink-0",
      },
    },
  }
);

/** One page as a thumbnail, which a click goes to. It names its page for assistive technology. */
function PageThumb({
  number,
  onPick,
  place,
  question,
  selected,
}: {
  number: number;
  onPick: () => void;
  place: "grid" | "strip";
  question: Question;
  selected: boolean;
}) {
  const t = useTranslations("Exams");
  const saved = !isPlaceholderId(question.prompt);

  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={pageThumb({ place })}
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
