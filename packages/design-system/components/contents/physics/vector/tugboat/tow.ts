import { Schema } from "effect";

/**
 * A ship towed by two tugboats whose cables open at an angle, the first
 * tug on the port side and the second on starboard, each the same half
 * angle off the ship's line. The resultant of the two cable forces follows
 * from the cosine rule on the angle between them, and its direction from
 * the sine rule: its angle from the first cable, then from the ship's line.
 */

/** The two cable forces, in kN. */
export const TugsSchema = Schema.Struct({
  first: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  second: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Tugs = typeof TugsSchema.Type;

/**
 * The resultant for an angle between the cables, in degrees: its size by
 * the cosine rule, its angle from the first cable by the sine rule, its
 * angle from the ship's line toward port, and its components along the
 * ship's line and toward port, by adding the cables' components.
 */
export function towResultant(tugs: Tugs, between: number) {
  const turn = (between * Math.PI) / 180;
  const half = turn / 2;
  const size = Math.sqrt(
    tugs.first ** 2 +
      tugs.second ** 2 +
      2 * tugs.first * tugs.second * Math.cos(turn)
  );
  const sine =
    (Math.asin(Math.min(1, (tugs.second * Math.sin(turn)) / size)) * 180) /
    Math.PI;
  const fromFirst =
    tugs.first ** 2 + size ** 2 < tugs.second ** 2 ? 180 - sine : sine;
  return {
    ahead: (tugs.first + tugs.second) * Math.cos(half),
    fromFirst,
    fromLine: between / 2 - fromFirst,
    port: (tugs.first - tugs.second) * Math.sin(half),
    size,
  };
}
