import {
  FullScreenIcon,
  GridViewIcon,
  Layout01Icon,
} from "@hugeicons/core-free-icons";
import { useReducedMotion } from "@mantine/hooks";
import { questionGap } from "@repo/backend/confect/exams/parts";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Slider } from "@repo/design-system/components/ui/slider";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { elementById } from "@repo/design-system/lib/element";
import { Array as Arr, Data, Effect, Option } from "effect";
import { type RefObject, useState, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
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
import { pageThumb, thumbPress } from "@/components/tenant/exams/thumb";
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
 * The editor's footer keeps page navigation centered. The teacher's panel or zoom sits at the start,
 * and grid view and full screen sit at the end. Each tool fits to the width of the editor itself,
 * whether the desk fills a screen or sits in the School landing.
 */
export function ExamFooter({ canvas, onZoom }: ExamFooterProps) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const { exam } = useExam();
  const active = useActiveQuestion();
  const pin = useExamSelection((state) => state.pin);
  const drawn = useExamZoom(drawnZoom);
  const grid = useEditorView((view) => view.mode === "grid");
  const toggleGrid = useEditorView((view) => view.toggleGrid);
  const reduce = useReducedMotion();
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesPress = useEarlyPress<HTMLButtonElement>(() =>
    setPagesOpen((open) => !open)
  );
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
    const page = elementById(`question-${question.id}`);
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
    <footer
      className="bg-background flex shrink-0 flex-col border-t"
      data-exam-footer=""
    >
      {pagesOpen && !grid ? (
        <div className="border-b">
          <ScrollArea
            aria-label={tCommon("pages")}
            className="w-full"
            render={<nav />}
          >
            <div className="flex w-max gap-3 p-3">
              {Arr.map(exam.questions, (question, index) => (
                <PageThumb
                  key={question.id}
                  number={index + 1}
                  onPick={() => goTo(question)}
                  question={question}
                  selected={selectedId === question.id}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : null}
      <div className="@container/bar grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-1.5">
        {grid ? null : (
          <>
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1">
              <ExamPanelButton />
              <div className="hidden items-center gap-1 @2xl/bar:flex">
                <Slider
                  aria-label={t("zoom")}
                  className="hidden w-40 @4xl/bar:flex"
                  max={ZOOM_STEPS}
                  min={0}
                  onValueChange={(position) => onZoom(zoomAt(position))}
                  step={1}
                  value={sliderPosition(drawn)}
                />
                <ZoomMenu onZoom={onZoom} />
              </div>
            </div>
            <div
              className="col-start-2 row-start-1 flex items-center gap-1"
              data-exam-navigation=""
            >
              <Button
                aria-pressed={pagesOpen}
                className="size-11 @sm/bar:size-9"
                size="icon"
                tooltip={tCommon("pages")}
                type="button"
                variant="ghost"
                {...pagesPress}
              >
                <HugeIcons aria-hidden="true" icon={Layout01Icon} />
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
            </div>
          </>
        )}
        <ButtonGroup
          className="col-start-3 row-start-1 justify-self-end"
          variant="ghost"
        >
          <Button
            aria-pressed={grid}
            className="size-11 @sm/bar:size-9"
            onClick={toggleGrid}
            size="icon"
            tooltip={t("grid")}
            type="button"
          >
            <HugeIcons aria-hidden="true" icon={GridViewIcon} />
          </Button>
          <Button
            aria-pressed={fullscreen}
            className="@max-sm/bar:hidden"
            disabled={!canFullscreen}
            onClick={toggleFullscreen}
            size="icon"
            tooltip={tCommon("fullscreen")}
            type="button"
          >
            <HugeIcons aria-hidden="true" icon={FullScreenIcon} />
          </Button>
        </ButtonGroup>
      </div>
    </footer>
  );
}

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
  const tCommon = useTranslations("Common");
  const saved = !isPlaceholderId(question.prompt);

  return (
    <div className={pageThumb()}>
      <QuestionPreview open={selected} question={question} saved={saved} />
      <button
        aria-current={selected ? "true" : undefined}
        className={thumbPress()}
        onClick={onPick}
        type="button"
      >
        <span className="sr-only">
          {tCommon("question", { number })}
          {Option.match(questionGap(question), {
            onNone: () => null,
            onSome: (gap) => ` ${t(gap === "empty" ? "empty-part" : "no-key")}`,
          })}
        </span>
      </button>
    </div>
  );
}
