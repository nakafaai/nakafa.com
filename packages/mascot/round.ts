import { Number as Num } from "effect";

/** Rounds to one decimal, the precision the points of a drawing are written in. */
export function tenth(value: number) {
  return Num.round(value, 1);
}
