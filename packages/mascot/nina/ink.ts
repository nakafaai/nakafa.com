import { NINA, TEXT } from "@repo/mascot/color";
import { at, type Place } from "@repo/mascot/nina/point";
import { path } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** A round line along `d` in one colour. */
function stroke(d: string, colour: string, width: number) {
  return path({
    d,
    fill: "none",
    stroke: colour,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** A round line of ink along `d`. */
export function ink(d: string, width = 5) {
  return stroke(d, NINA.ink, width);
}

/**
 * A round line that stands free of her body, such as a stroke of surprise. It
 * takes the colour of the text around her, so it shows on every ground: her
 * ink is dark and would vanish on a dark page. In a tile the ground is hers,
 * and the tile gives the line her ink.
 */
export function free(d: string) {
  return stroke(d, TEXT, 4);
}

/** The outline that moves to the first place and goes straight to each next one. */
export function line(...places: readonly Place[]) {
  return Arr.join(
    Arr.map(places, ([x, y], index) => `${index === 0 ? "M" : "L"}${at(x, y)}`),
    " "
  );
}
