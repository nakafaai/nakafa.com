import { tenth } from "@repo/mascot/round";

/** A place in her figure, as x and y. */
export type Place = readonly [number, number];

/** A place written the way her outlines write it: `x,y`. */
export function at(x: number, y: number) {
  return `${tenth(x)},${tenth(y)}`;
}
