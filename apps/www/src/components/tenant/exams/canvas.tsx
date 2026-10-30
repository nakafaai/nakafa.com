import { Add01Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef, useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr, Option } from "effect";
import { type RefObject, useEffect } from "react";
import { useTranslations } from "use-intl";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import { useQuestionReorder } from "@/components/tenant/exams/drag";
import { pageAt } from "@/components/tenant/exams/pages";
import { ExamPage } from "@/components/tenant/exams/paper";
import {
  useEditorView,
  useExam,
  useExamLocked,
  useExamSelectionStore,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import { drawnZoom, ZOOM_DEFAULT } from "@/components/tenant/exams/zoom";

/**
 * The distance, in pixels from the top of the canvas, at which a page counts as the one in view:
 * the page whose top has passed this line is the page the teacher is on.
 */
const PAGE_LINE = 96;

/**
 * The events that are the teacher's own hand on the canvas: a key, a press, a touch, or a wheel. One
 * of them ends the hold of a page the footer chose, so the scroll that follows chooses the page in view.
 */
const HAND_EVENTS = ["keydown", "pointerdown", "touchstart", "wheel"] as const;

/** The events that put the teacher's hand in a page: a press on it, or the focus moving into it. */
const PAGE_EVENTS = ["focusin", "pointerdown"] as const;

/** The side padding of the column of pages from the medium width up, as `md:px-6` draws it on each side. */
const COLUMN_PADDING = 48;

/**
 * Measures the width the pages may fill in the canvas while Fill is chosen, into the zoom's store, which
 * the canvas and the footer's percentage read. A canvas that fits or takes a chosen zoom measures nothing.
 * It follows the canvas as the panel is resized.
 */
function useFillWidth(
  canvas: RefObject<HTMLElement | null>,
  measuring: boolean
) {
  const measure = useExamZoom((zoom) => zoom.measure);
  useEffect(() => {
    const root = canvas.current;
    if (!measuring || root === null) {
      return;
    }
    const observer = new ResizeObserver(() =>
      measure(root.clientWidth - COLUMN_PADDING)
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [canvas, measure, measuring]);
}

/**
 * Brings the question the teacher opened from the grid into view once the canvas shows again, and holds
 * it as the one the teacher is on, as the footer's strip does.
 */
function useReveal(canvas: RefObject<HTMLElement | null>) {
  const reveal = useEditorView((view) => view.reveal);
  const settle = useEditorView((view) => view.settle);
  const selection = useExamSelectionStore();
  useEffect(() => {
    const root = canvas.current;
    if (reveal === null || root === null) {
      return;
    }
    const page = document.getElementById(`question-${reveal}`);
    if (page !== null) {
      root.scrollTo({
        top:
          root.scrollTop +
          page.getBoundingClientRect().top -
          root.getBoundingClientRect().top,
      });
    }
    selection.getState().pin(reveal);
    settle();
  }, [canvas, reveal, selection, settle]);
}

/**
 * The canvas of the exam: every question as a page, stacked in order with one gap between them,
 * on a muted ground that scrolls. Each page is its paper at the chosen zoom, and an add button as
 * wide as the pages, below the last one, adds a question at the end. The page the teacher is on
 * follows the scroll and the teacher's hand, so the footer's position and the panel name it. A
 * frozen exam shows its pages without the add button.
 */
export function ExamCanvas({
  canvas,
}: {
  canvas: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = useExamLocked();
  // The canvas reads the selection from its store when it runs, so a change of the choice draws no page.
  const selection = useExamSelectionStore();
  const actions = useQuestionActions();
  // A stable move keeps the listeners of the reorder attached across the renders of the canvas.
  const moveQuestion = useCallbackRef(actions.moveQuestion);
  const zoomed = useExamZoom(drawnZoom);
  const filling = useExamZoom((zoom) => zoom.mode === "fill");
  // The chosen zoom applies from the medium width up, where the footer shows its slider. A phone
  // keeps the default, since it pinches to zoom and has no slider to undo a stored zoom.
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);
  useFillWidth(canvas, wide && filling);
  const drawnPercent = wide ? zoomed : ZOOM_DEFAULT;
  useReveal(canvas);
  useQuestionReorder({
    canvas,
    moveQuestion,
    questions: exam.questions,
    requestFocus: selection.getState().requestFocus,
    zoom: drawnPercent / 100,
  });

  /** Chooses the page of an element the teacher pressed or focused, as a design tool chooses the page in hand. */
  const choosePage = useCallbackRef((event: Event) => {
    const page =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-question]")
        : null;
    const { select, selected } = selection.getState();
    Option.match(
      Arr.findFirst(
        exam.questions,
        (question) => question.id === page?.dataset.question
      ),
      {
        onNone: () => undefined,
        onSome: (question) => {
          if (selected !== question.id) {
            select(question.id);
          }
        },
      }
    );
  });
  useEffect(() => {
    const root = canvas.current;
    if (root === null) {
      return;
    }
    Arr.forEach(PAGE_EVENTS, (event) =>
      root.addEventListener(event, choosePage)
    );
    return () => {
      Arr.forEach(PAGE_EVENTS, (event) =>
        root.removeEventListener(event, choosePage)
      );
    };
  }, [canvas, choosePage]);

  // The teacher's hand ends the hold of a page the footer chose, so the page in view is chosen again.
  useEffect(() => {
    const root = canvas.current;
    if (root === null) {
      return;
    }
    const release = () => selection.getState().unpin();
    Arr.forEach(HAND_EVENTS, (event) =>
      root.addEventListener(event, release, { passive: true })
    );
    return () => {
      Arr.forEach(HAND_EVENTS, (event) =>
        root.removeEventListener(event, release)
      );
    };
  }, [canvas, selection]);

  /**
   * Chooses the page at the top of the canvas as the one the teacher is on, when the scroll brings a
   * new one. A page the footer holds stays chosen until the teacher's hand releases it, and so does the
   * page the teacher writes in, which a scroll that follows the caret must not take away.
   */
  const syncPage = () => {
    const root = canvas.current;
    const { pinned, select, selected } = selection.getState();
    if (
      root === null ||
      pinned ||
      root.querySelector("[data-page]:focus-within") !== null
    ) {
      return;
    }
    const top = root.getBoundingClientRect().top;
    const tops = Arr.map(
      Arr.fromIterable(root.querySelectorAll<HTMLElement>("[data-page]")),
      (page) => page.getBoundingClientRect().top - top
    );
    const index = pageAt(tops, PAGE_LINE);
    Option.match(Arr.get(exam.questions, index), {
      onNone: () => undefined,
      onSome: (question) => {
        if (selected !== question.id) {
          select(question.id);
        }
      },
    });
  };

  return (
    // The canvas scrolls in its scroll area's viewport, under an overlay bar that takes no room, so the
    // pages keep their width on every system. The viewport is what the canvas ref, its listeners, the
    // reveal, the footer's moves and the pages' windowing read.
    <ScrollArea
      aria-label={t("pages-label")}
      className="min-w-0 flex-1 bg-muted/40"
      onViewportScroll={syncPage}
      render={<section />}
      viewportClassName="relative"
      viewportRef={canvas}
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-6"
        style={{ zoom: drawnPercent / 100 }}
      >
        {Arr.map(exam.questions, (question, index) => (
          <ExamPage
            canvas={canvas}
            index={index}
            key={question.id}
            question={question}
          />
        ))}
        {frozen ? null : (
          <Button
            className="w-full"
            onClick={() => actions.addQuestion(null)}
            type="button"
            variant="outline"
          >
            <HugeIcons aria-hidden="true" icon={Add01Icon} />
            {t("add-question")}
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
