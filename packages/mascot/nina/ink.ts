import { NINA } from "@repo/mascot/color";
import { at, type Place } from "@repo/mascot/nina/point";
import { path } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** A round line of ink along `d`. */
export function ink(d: string, width = 5) {
  return path({
    d,
    fill: "none",
    stroke: NINA.ink,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** The outline that moves to the first place and goes straight to each next one. */
export function line(...places: readonly Place[]) {
  return Arr.join(
    Arr.map(places, ([x, y], index) => `${index === 0 ? "M" : "L"}${at(x, y)}`),
    " "
  );
}
