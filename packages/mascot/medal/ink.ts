import { path } from "@repo/mascot/shape";
import { Schema } from "effect";

/**
 * The colours an emblem is drawn in: its light and dark, and three colours of
 * its own. An earned medal gives it the identity's colours; a medal still to
 * earn gives it one colour for all of them, so it shows as a silhouette.
 */
const InkSchema = Schema.Struct({
  dark: Schema.String,
  first: Schema.String,
  light: Schema.String,
  second: Schema.String,
  third: Schema.String,
});

export type Ink = typeof InkSchema.Type;

/** A round line along `d`. */
export function stroke(d: string, colour: string, width: number) {
  return path({
    d,
    fill: "none",
    stroke: colour,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}
