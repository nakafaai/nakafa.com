import { Add01Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef, useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr, Option } from "effect";
import { type RefObject, useEffect } from "react";
import { useTranslations } from "use-intl";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import { useQuestionReorder } from "@/components/tenant/exams/drag";
import { isLocked } from "@/components/tenant/exams/freeze";
import { pageAt } from "@/components/tenant/exams/pages";
import { ExamPage } from "@/components/tenant/exams/paper";
import {
  useExam,
  useExamSelectionStore,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import { ZOOM_DEFAULT } from "@/components/tenant/exams/zoom";

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

/**
 * The canvas of the exam: every question as a page, stacked in order with one gap between them,
 * on a muted ground that scrolls. Each page is its paper at the chosen zoom, and an add button as
 * wide as the pages, below the last one, adds a question at the end. The page the teacher is on follows the scroll,
 * so the footer's position names it. A frozen exam shows its pages without the add button.
 */
export function ExamCanvas({
  canvas,
}: {
  canvas: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  // The canvas reads the selection from its store when it runs, so a change of the choice draws no page.
  const selection = useExamSelectionStore();
  const actions = useQuestionActions();
  // A stable move keeps the listeners of the reorder attached across the renders of the canvas.
  const moveQuestion = useCallbackRef(actions.moveQuestion);
  const percent = useExamZoom((zoom) => zoom.percent);
  // The chosen zoom applies from the medium width up, where the footer shows its slider. A phone
  // keeps the default, since it pinches to zoom and has no slider to undo a stored zoom.
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);
  const drawnZoom = wide ? percent : ZOOM_DEFAULT;
  useQuestionReorder({
    canvas,
    moveQuestion,
    questions: exam.questions,
    requestFocus: selection.getState().requestFocus,
    zoom: drawnZoom / 100,
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
    <section
      aria-label={t("pages-label")}
      className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/40"
      onScroll={syncPage}
      ref={canvas}
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-6"
        style={{ zoom: drawnZoom / 100 }}
      >
        {Arr.map(exam.questions, (question, index) => (
          <ExamPage
            canvas={canvas}
            count={exam.questions.length}
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
    </section>
  );
}
