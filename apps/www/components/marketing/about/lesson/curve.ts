import { Array as Arr, Schema } from "effect";

/** A point of a lesson curve, in the units of its own lesson. */
const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** A point of a lesson curve. */
type Point = typeof PointSchema.Type;

/** The window that a curve is fitted into, in the units of the curve. */
const BoxSchema = Schema.Struct({
  height: Schema.Finite,
  maxX: Schema.Finite,
  maxY: Schema.Finite,
  minX: Schema.Finite,
  minY: Schema.Finite,
  width: Schema.Finite,
});

/** The window that a curve is fitted into. */
type Box = typeof BoxSchema.Type;

/** Gravity of the projectile lesson, in metres per second squared. */
export const GRAVITY = 10;

/** Points sampled along each curve: a smooth line at the size of a lesson picture. */
const SAMPLES = 64;

/**
 * Samples the flight of a ball thrown at `speed` metres per second and `angle`
 * degrees, from the moment it leaves the hand until it lands.
 */
export function projectilePath(speed: number, angle: number): Point[] {
  const radians = (angle * Math.PI) / 180;
  const horizontal = speed * Math.cos(radians);
  const vertical = speed * Math.sin(radians);
  const flight = (2 * vertical) / GRAVITY;
  return Arr.makeBy(SAMPLES + 1, (index) => {
    const time = (flight * index) / SAMPLES;
    return {
      x: horizontal * time,
      y: vertical * time - (GRAVITY * time * time) / 2,
    };
  });
}

/** The quadratic x squared minus four x plus three. */
export function quadratic(x: number): number {
  return x * x - 4 * x + 3;
}

/** Samples the quadratic from `from` to `to`. */
export function quadraticPath(from: number, to: number): Point[] {
  return Arr.makeBy(SAMPLES + 1, (index) => {
    const x = from + ((to - from) * index) / SAMPLES;
    return { x, y: quadratic(x) };
  });
}

/**
 * The smallest window that holds every point of a curve, sized to a picture of
 * `width` by `height`.
 */
export function fitBox(
  points: readonly Point[],
  width: number,
  height: number
): Box {
  return {
    height,
    maxX: Arr.reduce(points, Number.NEGATIVE_INFINITY, (top, point) =>
      Math.max(top, point.x)
    ),
    maxY: Arr.reduce(points, Number.NEGATIVE_INFINITY, (top, point) =>
      Math.max(top, point.y)
    ),
    minX: Arr.reduce(points, Number.POSITIVE_INFINITY, (low, point) =>
      Math.min(low, point.x)
    ),
    minY: Arr.reduce(points, Number.POSITIVE_INFINITY, (low, point) =>
      Math.min(low, point.y)
    ),
    width,
  };
}

/**
 * The window of a physical path, such as a flight, sized to `width` with the
 * height that keeps one scale on both axes. A flight keeps its true shape this
 * way, where `fitBox` would stretch it to the height of the picture.
 */
export function fitSameScale(points: readonly Point[], width: number): Box {
  const extent = fitBox(points, 1, 1);
  const height =
    (width * (extent.maxY - extent.minY)) / (extent.maxX - extent.minX);
  return fitBox(points, width, height);
}

/**
 * The two ends of the bonds of a bent molecule, counted from its centre at the
 * origin. Each bond is `length` long, and the two bonds open at `angle` degrees
 * with their ends above the centre, as the screen draws them (y grows down).
 */
export function bondEnds(angle: number, length: number): Point[] {
  const half = (angle * Math.PI) / 360;
  return Arr.makeBy(2, (index) => {
    const side = index === 0 ? -1 : 1;
    return {
      x: side * length * Math.sin(half),
      y: -length * Math.cos(half),
    };
  });
}

/**
 * The path data of a curve fitted into a picture of `width` by `height`. The
 * vertical axis points up, as on paper, so a higher y is a higher line.
 */
export function pathData(points: readonly Point[], box: Box): string {
  const scaleX = box.width / (box.maxX - box.minX);
  const scaleY = box.height / (box.maxY - box.minY);
  return Arr.join(
    Arr.map(points, (point, index) => {
      const x = (point.x - box.minX) * scaleX;
      const y = box.height - (point.y - box.minY) * scaleY;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }),
    " "
  );
}
