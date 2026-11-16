import { Array as Arr, Schema } from "effect";

/** A place on a stage, in hundredths of its width and of its height, so a stage of any size holds it. */
export const Point = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type Point = typeof Point.Type;

/** Whether a wire leaves and arrives down a column or along a row. */
const Axis = Schema.Literals(["column", "row"]);

/** A wire as the four points of one curve: its start, the two points that bend it, and its end. */
export const Wire = Schema.Tuple([Point, Point, Point, Point]);
export type Wire = typeof Wire.Type;

/** The width and height of a stage in pixels. */
export const Size = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});

/** How many moments of a wire a thing passes on its way, enough for a smooth curve. */
const STEPS = 12;

/**
 * The wire between two places of a stage. It leaves its start and reaches its
 * end along the axis, and bends halfway, so wires from one place to a row of
 * others fan out like branches and never cross a neighbour.
 */
export function wire(from: Point, to: Point, axis: typeof Axis.Type): Wire {
  if (axis === "column") {
    const middle = (from.y + to.y) / 2;
    return [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to];
  }
  const middle = (from.x + to.x) / 2;
  return [from, { x: middle, y: from.y }, { x: middle, y: to.y }, to];
}

/** A wire as the path an SVG draws on a stage of 100 by 100. */
export function wirePath([start, first, second, end]: Wire) {
  return `M${start.x},${start.y} C${first.x},${first.y} ${second.x},${second.y} ${end.x},${end.y}`;
}

/** The place on a wire at `progress`, from 0 at its start to 1 at its end. */
export function along([start, first, second, end]: Wire, progress: number) {
  const rest = 1 - progress;
  const weights = [
    rest ** 3,
    3 * rest ** 2 * progress,
    3 * rest * progress ** 2,
    progress ** 3,
  ] as const;
  return {
    x:
      weights[0] * start.x +
      weights[1] * first.x +
      weights[2] * second.x +
      weights[3] * end.x,
    y:
      weights[0] * start.y +
      weights[1] * first.y +
      weights[2] * second.y +
      weights[3] * end.y,
  };
}

/** Progress that starts and ends slowly, so a thing leaves and lands softly when its way is played at an even pace. */
function eased(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

/**
 * The way of a thing along a wire on a stage of a given size, as the pixel
 * offsets it passes from the stage's top left corner, start and end included.
 * The moments lie closer together near both ends, so the thing eases out of
 * its start and into its end.
 */
export function travel(path: Wire, size: typeof Size.Type) {
  const places = Arr.makeBy(STEPS + 1, (step) =>
    along(path, eased(step / STEPS))
  );
  return {
    x: Arr.map(places, (place) => (place.x / 100) * size.width),
    y: Arr.map(places, (place) => (place.y / 100) * size.height),
  };
}
