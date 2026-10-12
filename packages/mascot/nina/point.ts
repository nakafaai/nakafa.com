import { Number as Num } from "effect";

/** A place in her figure, as x and y. */
export type Place = readonly [number, number];

/** Rounds to one decimal, the precision her drawing is written in. */
export function tenth(value: number) {
  return Num.round(value, 1);
}

/** A place written the way her outlines write it: `x,y`. */
export function at(x: number, y: number) {
  return `${tenth(x)},${tenth(y)}`;
}
