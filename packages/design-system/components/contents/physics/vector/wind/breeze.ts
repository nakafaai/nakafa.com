import { Schema } from "effect";

/**
 * Wind as a vector: a speed and the direction it blows toward, as an angle
 * in standard position, degrees counterclockwise from east. Its components
 * are the cosine part toward east and the sine part toward north, and their
 * signs follow the quadrant the wind blows into. A steady wind over a sea is
 * the same vector at every place on the map.
 */

/** The wind: speed in m/s and the angle it blows toward, in degrees from east. */
export const BreezeSchema = Schema.Struct({
  angle: Schema.Finite,
  speed: Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});
type Breeze = typeof BreezeSchema.Type;

/** The wind's components east and north, in m/s, and the quadrant it blows into (0 on an axis). */
export function breezeParts(breeze: Breeze) {
  const turn = (breeze.angle * Math.PI) / 180;
  const east = breeze.speed * Math.cos(turn);
  const north = breeze.speed * Math.sin(turn);
  const tidy = (value: number) => (Math.abs(value) < 1e-9 ? 0 : value);
  return {
    east: tidy(east),
    north: tidy(north),
    quadrant: quadrantOf(tidy(east), tidy(north)),
  };
}

/** The quadrant a vector points into, 1 to 4 counterclockwise from the first, or 0 when it lies on an axis. */
export function quadrantOf(east: number, north: number) {
  if (east === 0 || north === 0) {
    return 0;
  }
  if (north > 0) {
    return east > 0 ? 1 : 2;
  }
  return east < 0 ? 3 : 4;
}
