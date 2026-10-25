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
