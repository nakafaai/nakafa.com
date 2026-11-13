import { Schema } from "effect";

/**
 * An aircraft in a crosswind, seen from above. It flies through the air at
 * its airspeed along its heading, and the air itself moves with the wind,
 * so its velocity over the ground is the sum of the two vectors. Directions
 * are bearings: degrees clockwise from north. The ground speed follows from
 * the cosine rule on the angle between the two vectors, and the drift
 * between heading and track from the sine rule.
 */

/** The flight: airspeed and wind speed in km/h, and the bearing the wind blows toward in degrees. */
export const CrosswindSchema = Schema.Struct({
  airspeed: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  toward: Schema.Finite,
  wind: Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});
type Crosswind = typeof CrosswindSchema.Type;

/** A bearing in degrees as a vector east and north of the given size. */
export function bearingVector(size: number, bearing: number) {
  const turn = (bearing * Math.PI) / 180;
  return { east: size * Math.sin(turn), north: size * Math.cos(turn) };
}

/** An angle in degrees brought into (-180, 180]. */
export function signedAngle(angle: number) {
  const wrapped = ((angle % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * The velocity over the ground for a heading: its components east and
 * north, its speed, its track as a bearing, the drift from heading to track
 * (positive to the right), and the angle between the air and wind vectors.
 */
export function groundVelocity(flight: Crosswind, heading: number) {
  const air = bearingVector(flight.airspeed, heading);
  const wind = bearingVector(flight.wind, flight.toward);
  const east = air.east + wind.east;
  const north = air.north + wind.north;
  const track = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return {
    between: Math.abs(signedAngle(flight.toward - heading)),
    drift: signedAngle(track - heading),
    east,
    north,
    speed: Math.hypot(east, north),
    track,
  };
}

/** The ground speed by the cosine rule from the two speeds and the angle between them, in degrees. */
export function cosineSpeed(airspeed: number, wind: number, between: number) {
  const turn = (between * Math.PI) / 180;
  return Math.sqrt(
    Math.max(
      0,
      airspeed ** 2 + wind ** 2 + 2 * airspeed * wind * Math.cos(turn)
    )
  );
}

/** The size of the drift by the sine rule, in degrees, from the wind speed, the angle between, and the ground speed. */
export function sineDrift(wind: number, between: number, speed: number) {
  const turn = (between * Math.PI) / 180;
  return speed === 0
    ? 0
    : (Math.asin(Math.min(1, (wind * Math.sin(turn)) / speed)) * 180) / Math.PI;
}
