import { Array as Arr, Option, Schema } from "effect";

/** One page of the canvas as the layout places it, in layout pixels from the top of the canvas. */
export const PageBox = Schema.Struct({
  height: Schema.Finite,
  top: Schema.Finite,
});
export type PageBox = typeof PageBox.Type;

/** The middle of a page, which decides the place a dragged page takes among the others. */
const middleOf = (box: PageBox) => box.top + box.height / 2;

/**
 * The index a dragged page takes after the pointer has moved it `offset` layout pixels: the number
 * of the other pages whose middle lies above the middle of the dragged page. A page that is not on
 * the canvas keeps its place, so the caller never moves a page it does not hold.
 */
export const dropIndex = (
  boxes: readonly PageBox[],
  from: number,
  offset: number
): number =>
  Option.match(Arr.get(boxes, from), {
    onNone: () => from,
    onSome: (dragged) => {
      const middle = middleOf(dragged) + offset;
      return Arr.filter(
        boxes,
        (box, index) => index !== from && middleOf(box) < middle
      ).length;
    },
  });

/** The band at each end of the canvas, in pixels, where a dragged page scrolls the canvas. */
const EDGE_BAND = 72;

/** The most a dragged page scrolls the canvas in one frame, in pixels, with the pointer at the canvas's end or past it. */
const EDGE_SPEED = 24;

/** How deep the pointer stands in an end's band, scaled to the speed of one frame. */
const edgeSpeed = (depth: number) =>
  Math.ceil((Math.min(depth, EDGE_BAND) / EDGE_BAND) * EDGE_SPEED);

/**
 * How far a page dragged with the pointer at `pointer` scrolls a canvas that stands from `top` to `bottom`
 * this frame: up or down as the pointer enters an end's band, faster the deeper it goes, and not at all
 * between the bands. So a question moves past the pages the screen shows, however long the exam is.
 */
export const edgeScroll = (
  pointer: number,
  top: number,
  bottom: number
): number => {
  const above = top + EDGE_BAND - pointer;
  if (above > 0) {
    return -edgeSpeed(above);
  }
  const below = pointer - (bottom - EDGE_BAND);
  return below > 0 ? edgeSpeed(below) : 0;
};

/**
 * How far a page that is not dragged moves while the dragged page takes `target` in place of `from`.
 * The pages between the two places move by `step`, the dragged page's height and the gap after it,
 * toward its old place, and every other page stays where it is.
 */
export const siblingShift = (
  index: number,
  from: number,
  target: number,
  step: number
): number => {
  if (from < target && index > from && index <= target) {
    return -step;
  }
  if (target < from && index >= target && index < from) {
    return step;
  }
  return 0;
};

/**
 * The place of the question a grip names: its index in the order and its ID, or none when the grip
 * names no question of the order. A grip names its question with the ID in its `data-grip` attribute,
 * which is absent from a grip that the canvas does not own.
 */
export const placeOf = <QuestionId extends string>(
  questionIds: readonly QuestionId[],
  gripId: string | undefined
) =>
  Option.flatMap(Option.fromNullishOr(gripId), (id) =>
    Arr.findFirst(
      Arr.map(questionIds, (questionId, index) => ({ index, questionId })),
      (place) => place.questionId === id
    )
  );

/**
 * The index a question takes when a focused grip steps it by `step` places, or none when the step
 * leaves the order: the first question does not move up, and the last one does not move down.
 */
export const steppedIndex = (
  index: number,
  step: number,
  count: number
): Option.Option<number> => {
  const to = index + step;
  return to >= 0 && to < count ? Option.some(to) : Option.none();
};
