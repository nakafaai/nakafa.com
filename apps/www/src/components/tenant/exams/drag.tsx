import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import { type RefObject, useEffect, useRef } from "react";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";
import {
  dropIndex,
  type PageBox,
  siblingShift,
} from "@/components/tenant/exams/reorder";

/** The glide of the pages that make room while a page is dragged. */
const GLIDE = "transform 160ms ease";

/** The arrow keys that move a focused grip one page up or down. */
const STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowUp: -1,
};

/** The place of a question in the order: its index, and its ID. */
const Place = Schema.Struct({
  index: Schema.Int,
  questionId: Id("examQuestions"),
});
type Place = typeof Place.Type;

/** The grip an event came from, when the event came from one. */
const gripOf = (target: EventTarget | null): Option.Option<HTMLElement> =>
  target instanceof Element
    ? Option.fromNullishOr(target.closest<HTMLElement>("[data-grip]"))
    : Option.none();

/** The place of the question a grip stands for, when the grip names a question of the order. */
const placeOf = (
  questions: readonly Question[],
  grip: HTMLElement
): Option.Option<Place> =>
  Arr.findFirst(
    Arr.map(questions, (question, index) => ({
      index,
      questionId: question.id,
    })),
    (place) => place.questionId === grip.dataset.grip
  );

/** The gap between two pages, which the canvas sets as the row gap of its stack. */
const gapOf = (root: HTMLElement) => {
  const stack = root.firstElementChild;
  const gap =
    stack === null ? 0 : Number.parseFloat(getComputedStyle(stack).rowGap);
  return Number.isFinite(gap) ? gap : 0;
};

/** The box of a page as the layout places it. */
const boxOf = (page: HTMLElement): PageBox => ({
  height: page.offsetHeight,
  top: page.offsetTop,
});

/**
 * Lays the pages out for a drag: the dragged page follows the pointer, and each page between its
 * place and the target glides aside by the dragged page's step.
 */
const showDrag = (
  pages: readonly HTMLElement[],
  drag: {
    readonly from: number;
    readonly offset: number;
    readonly step: number;
    readonly target: number;
  }
) => {
  Arr.forEach(pages, (page, index) => {
    if (index === drag.from) {
      page.style.transition = "";
      page.style.transform = `translateY(${drag.offset}px)`;
      return;
    }
    page.style.transition = GLIDE;
    page.style.transform = `translateY(${siblingShift(index, drag.from, drag.target, drag.step)}px)`;
  });
};

/** Clears every transform of a drag, so the pages take their layout places again. */
const clearDrag = (pages: readonly HTMLElement[]) => {
  Arr.forEach(pages, (page) => {
    page.style.transform = "";
    page.style.transition = "";
  });
};

/**
 * Starts a drag of the page whose grip the pointer pressed. The drag ends on release, which saves
 * the move when the page changed its place, or on a cancelled pointer or Escape, which keeps the
 * order. Returns the function that cancels the drag, or none when the grip names no question.
 */
const beginDrag = (
  root: HTMLElement,
  grip: HTMLElement,
  questions: readonly Question[],
  press: PointerEvent,
  zoom: number,
  moveQuestion: (questionId: QuestionId, index: number) => void,
  settled: () => void
): (() => void) | null => {
  const place = placeOf(questions, grip);
  if (Option.isNone(place)) {
    return null;
  }
  const { index: from, questionId } = place.value;
  const pages = Arr.fromIterable(
    root.querySelectorAll<HTMLElement>("[data-page]")
  );
  const boxes = Arr.map(pages, boxOf);
  const step = (boxes[from]?.height ?? 0) + gapOf(root);
  let offset = 0;
  let target = from;

  const onMove = (move: PointerEvent) => {
    offset = (move.clientY - press.clientY) / zoom;
    target = dropIndex(boxes, from, offset);
    showDrag(pages, { from, offset, step, target });
  };
  const detach = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onRelease);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onKey);
    settled();
  };
  const cancel = () => {
    detach();
    clearDrag(pages);
  };
  const onRelease = () => {
    detach();
    // The pages return to their places in the same task that starts the move, so React commits the new
    // order before the browser paints, and no page shows its old place in between.
    clearDrag(pages);
    if (target !== from) {
      moveQuestion(questionId, target);
    }
  };
  const onKey = (key: KeyboardEvent) => {
    if (key.key === "Escape") {
      cancel();
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onRelease);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", onKey);
  return cancel;
};

/** The props of the reorder of the canvas. */
interface ReorderOptions {
  /** The canvas that holds every page and every grip. */
  readonly canvas: RefObject<HTMLElement | null>;
  /** Moves a question to an index of the order, and shows the move at once. */
  readonly moveQuestion: (questionId: QuestionId, index: number) => void;
  /** The questions in their order, which decides where a grip's page stands. */
  readonly questions: readonly Question[];
  /** The zoom the canvas draws at, as a factor, where 1 is the default size. */
  readonly zoom: number;
}

/**
 * Reorders the questions of the canvas two ways, from one listener on the canvas each. A grip
 * dragged with the pointer moves its page under the pointer while the other pages glide aside, and
 * the move is saved on release; Escape or a cancelled pointer keeps the order. A focused grip moves
 * its page one place with the up and down arrow keys, and keeps the focus once the new order shows.
 * Pages move by their transforms, so no page changes the layout of another.
 */
export function useQuestionReorder({
  canvas,
  moveQuestion,
  questions,
  zoom,
}: ReorderOptions) {
  // The question the arrow keys moved, whose grip takes the focus again once the new order shows.
  const focusNext = useRef<QuestionId | null>(null);
  // The drag in progress, which a second press waits for, and which the unmounted canvas cancels.
  const activeDrag = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      activeDrag.current?.();
    },
    []
  );

  useEffect(() => {
    const root = canvas.current;
    if (root === null) {
      return;
    }
    // The new order is on the screen, so the grip that the arrow keys moved takes the focus again.
    const moved = focusNext.current;
    if (moved !== null) {
      focusNext.current = null;
      root.querySelector<HTMLElement>(`[data-grip="${moved}"]`)?.focus();
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || activeDrag.current !== null) {
        return;
      }
      const grip = gripOf(event.target);
      if (Option.isSome(grip)) {
        // A press on a grip drags the page, so the press selects no text of the paper under the pointer.
        event.preventDefault();
        activeDrag.current = beginDrag(
          root,
          grip.value,
          questions,
          event,
          zoom,
          moveQuestion,
          () => {
            activeDrag.current = null;
          }
        );
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const step = STEP_BY_KEY[event.key];
      const grip = gripOf(event.target);
      if (step === undefined || Option.isNone(grip)) {
        return;
      }
      Option.match(placeOf(questions, grip.value), {
        onNone: () => undefined,
        onSome: ({ index, questionId }) => {
          const to = index + step;
          if (to < 0 || to >= questions.length) {
            return;
          }
          event.preventDefault();
          focusNext.current = questionId;
          moveQuestion(questionId, to);
        },
      });
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [canvas, moveQuestion, questions, zoom]);
}
