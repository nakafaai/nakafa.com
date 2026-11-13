import { Match, Schema } from "effect";

/**
 * Checkpoints on an orienteering map, in metres east and north of the start
 * O. The vector from A to B is B's position minus A's, whatever path the
 * runner takes; the vector from B to A has the same length and points the
 * other way; and the same vector drawn from C is equal to it, because a
 * vector is only its length and its direction, not its place.
 */

/** A place on the map, in metres east and north of the start. */
export const MarkSchema = Schema.Struct({
  east: Schema.Finite,
  north: Schema.Finite,
});
export type Mark = typeof MarkSchema.Type;

/** The three checkpoints. */
export const MarksSchema = Schema.Struct({
  a: MarkSchema,
  b: MarkSchema,
  c: MarkSchema,
});
export type Marks = typeof MarksSchema.Type;

/** What the map draws: A to B, B to A, A to B again from C, or A to B as the difference of the positions of B and A. */
export const ViewSchema = Schema.Literals([
  "forward",
  "back",
  "copy",
  "difference",
]);
export type View = typeof ViewSchema.Type;

/** The vector from one place to another: its components, length and angle counterclockwise from east, in metres and degrees. */
export function markVector(from: Mark, to: Mark) {
  const east = to.east - from.east;
  const north = to.north - from.north;
  const size = Math.hypot(east, north);
  return {
    angle:
      size < 1e-9 ? 0 : ((Math.atan2(north, east) * 180) / Math.PI + 360) % 360,
    east,
    north,
    size,
  };
}

/** Where the shown arrow starts and the vector it shows, for each view. */
export function shownVector(marks: Marks, view: View) {
  return Match.value(view).pipe(
    Match.when("back", () => ({
      from: marks.b,
      vector: markVector(marks.b, marks.a),
    })),
    Match.when("copy", () => ({
      from: marks.c,
      vector: markVector(marks.a, marks.b),
    })),
    Match.orElse(() => ({
      from: marks.a,
      vector: markVector(marks.a, marks.b),
    }))
  );
}
