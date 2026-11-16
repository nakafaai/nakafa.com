/**
 * Rain falling straight down on a still day, seen from a moving car. In the
 * ground's frame the drops fall vertically; in the car's frame every drop
 * also moves backward at the car's speed, so the rain arrives on a slant,
 * faster than it falls. Large raindrops (about 2 mm) fall at about 6.5 m/s
 * (Gunn and Kinzer 1949, "The terminal velocity of fall for water droplets
 * in stagnant air"), which the card takes as its default.
 */

/** The rain's speed and angle from the vertical as seen from a car moving at `car` m/s. */
export function apparentRain(rain: number, car: number) {
  return {
    angle: (Math.atan2(car, rain) * 180) / Math.PI,
    speed: Math.hypot(rain, car),
  };
}
