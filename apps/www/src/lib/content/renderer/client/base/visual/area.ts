import {
  Array as Arr,
  Option,
  Order,
  pipe,
  Record as Rec,
  Schema,
} from "effect";

/** One point of a still, right and up from the camera's target, in scene units. */
export const StillPointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type StillPoint = typeof StillPointSchema.Type;

/** A cell the outline does not cut, as the four sides of its square. */
const BoxSchema = Schema.Struct({
  bottom: Schema.Finite,
  left: Schema.Finite,
  right: Schema.Finite,
  top: Schema.Finite,
});
type Box = typeof BoxSchema.Type;

/** The box of a ring that is an upright square, a cell wholly inside the region. */
function boxOf(ring: readonly StillPoint[]): Option.Option<Box> {
  const xs = Arr.dedupe(Arr.map(ring, ([x]) => x));
  const ys = Arr.dedupe(Arr.map(ring, ([, y]) => y));
  if (ring.length !== 4 || xs.length !== 2 || ys.length !== 2) {
    return Option.none();
  }
  return Option.some({
    bottom: Math.min(...ys),
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.max(...ys),
  });
}

/** Joins the boxes of each line that touch end to start, so a run of cells becomes one box. */
function joinRuns(
  boxes: readonly Box[],
  line: (box: Box) => string,
  start: (box: Box) => number,
  end: (box: Box) => number,
  extend: (first: Box, next: Box) => Box
): readonly Box[] {
  return Arr.flatMap(Rec.values(Arr.groupBy(boxes, line)), (group) =>
    Arr.reduce(
      Arr.sort(group, Order.mapInput(Order.Number, start)),
      Arr.empty<Box>(),
      (joined, box) =>
        pipe(
          Arr.last(joined),
          Option.filter((last) => end(last) === start(box)),
          Option.match({
            onNone: () => Arr.append(joined, box),
            onSome: (last) =>
              Arr.append(Arr.dropRight(joined, 1), extend(last, box)),
          })
        )
    )
  );
}

/**
 * Merges the cells that shade a region into the fewest rings that cover the same area. The region's sampler shades
 * one shape per cell of its grid, thousands for a region that fills the frame, which the scene draws as one mesh but
 * a still would write into the page's HTML one by one. Every cell wholly inside is an upright square, so the squares
 * of each row join into one box, and boxes of equal width stacked on each other join again; a cell the outline cuts
 * keeps its own shape.
 */
export function mergeCells(
  rings: readonly (readonly StillPoint[])[]
): readonly (readonly StillPoint[])[] {
  const boxes = Arr.getSomes(Arr.map(rings, boxOf));
  const cut = Arr.filter(rings, (ring) => Option.isNone(boxOf(ring)));
  const rows = joinRuns(
    boxes,
    ({ bottom, top }) => `${bottom}:${top}`,
    ({ left }) => left,
    ({ right }) => right,
    (first, next) => ({ ...first, right: next.right })
  );
  const blocks = joinRuns(
    rows,
    ({ left, right }) => `${left}:${right}`,
    ({ bottom }) => bottom,
    ({ top }) => top,
    (first, next) => ({ ...first, top: next.top })
  );
  return [
    ...Arr.map(blocks, ({ bottom, left, right, top }) => [
      [left, bottom] as const,
      [right, bottom] as const,
      [right, top] as const,
      [left, top] as const,
    ]),
    ...cut,
  ];
}
