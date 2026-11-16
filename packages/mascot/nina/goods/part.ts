import type { Mark } from "@repo/mascot/nina/mark";
import { tenth } from "@repo/mascot/round";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";

/** One thing she holds or stands by, as its shapes around its own origin. */
export type Parts = readonly Shape<Mark>[];

/** A box with round corners, from its top left corner. */
export function box(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  rx = 3
) {
  return rect({ fill, height, rx, width, x, y });
}

/** A round dot. */
export function dot(x: number, y: number, r: number, fill: string) {
  return circle({ cx: x, cy: y, fill, r });
}

/** A round line along `d`. */
export function bar(d: string, colour: string, width: number) {
  return path({
    d,
    fill: "none",
    stroke: colour,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** A flat shape along `d`. */
export function flat(d: string, fill: string) {
  return path({ d, fill });
}

/** Shapes moved to x, y, turned by `turn` degrees about that place, and drawn `size` times as large. */
export function turned(
  parts: Parts,
  x: number,
  y: number,
  turn: number,
  size = 1
) {
  return group(parts, {
    transform: `translate(${tenth(x)} ${tenth(y)}) rotate(${tenth(turn)}) scale(${size})`,
  });
}
