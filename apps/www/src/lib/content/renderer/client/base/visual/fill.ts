import type { SpacePoint } from "@nakafa/aksara-contracts/math/base";
import { Array as Arr, Option, Order, Record, Result, Schema } from "effect";

/** A filled cell of the sampling grid that is a whole rectangle, by its sides. */
const RectangleSchema = Schema.Struct({
  bottom: Schema.Finite,
  left: Schema.Finite,
  right: Schema.Finite,
  top: Schema.Finite,
  z: Schema.Finite,
});
type Rectangle = typeof RectangleSchema.Type;

const byLeft = Order.mapInput(Order.Number, (cell: Rectangle) => cell.left);

/** The rectangle a cell covers, when its four corners take two x and two y values on one plane. */
function rectangleOf(cell: readonly SpacePoint[]): Option.Option<Rectangle> {
  const xs = Arr.dedupe(Arr.map(cell, (point) => point.x));
  const ys = Arr.dedupe(Arr.map(cell, (point) => point.y));
  const zs = Arr.dedupe(Arr.map(cell, (point) => point.z));
  if (cell.length !== 4 || xs.length !== 2 || ys.length !== 2) {
    return Option.none();
  }
  return Option.flatMap(Arr.head(zs), (z) =>
    zs.length === 1
      ? Option.some({
          bottom: Math.min(...ys),
          left: Math.min(...xs),
          right: Math.max(...xs),
          top: Math.max(...ys),
          z,
        })
      : Option.none()
  );
}

/** Joins the rectangles of one grid row that touch side by side into the runs they make. */
function runsOf(row: readonly Rectangle[]): Rectangle[] {
  return Arr.reduce(
    Arr.sort(row, byLeft),
    Arr.empty<Rectangle>(),
    (runs, cell) =>
      Option.match(Arr.last(runs), {
        onNone: () => [cell],
        onSome: (run): Rectangle[] =>
          run.right === cell.left
            ? [...Arr.dropRight(runs, 1), { ...run, right: cell.right }]
            : [...runs, cell],
      })
  );
}

/** The four corners of a run, counterclockwise from its bottom left. */
function cornersOf({ bottom, left, right, top, z }: Rectangle) {
  return [
    { x: left, y: bottom, z },
    { x: right, y: bottom, z },
    { x: right, y: top, z },
    { x: left, y: top, z },
  ];
}

/**
 * Fills a region with as few shapes as cover the same area. A region's fill
 * comes as one shape per cell of its sampling grid, thousands of them, and a
 * still draws one path per shape, which put a lesson past the two megabytes
 * Googlebot reads. Whole cells of one row that touch become one rectangle; the
 * cells the edge cuts keep their own shape.
 */
export function joinRegionFill(
  fill: readonly (readonly SpacePoint[])[]
): readonly (readonly SpacePoint[])[] {
  const [whole, cut] = Arr.partition(fill, (cell) =>
    Result.fromOption(rectangleOf(cell), () => cell)
  );
  const rows = Record.values(
    Arr.groupBy(whole, (cell) => `${cell.z}:${cell.bottom}:${cell.top}`)
  );
  return [
    ...Arr.flatMap(rows, (row) => Arr.map(runsOf(row), cornersOf)),
    ...cut,
  ];
}
