import { Array as Arr } from "effect";

/**
 * Waves for the wave labs. A wave's frequency is set by its source, so it
 * keeps its frequency across a boundary while its speed and wavelength
 * change, v = f λ, and its direction bends by sin r / sin i = v₂ / v₁. Two
 * coherent sources a apart, seen on a line D away, give loud or bright
 * points x = λ D / a apart, and the intensity at a point follows the path
 * difference Δ between the two sources: cos²(π Δ / λ). An echo returns
 * after the sound has covered the way to the reflector and back.
 */

/** Degrees in one radian. */
const DEGREE = Math.PI / 180;

/** A wave crossing from deep to shallow water: its frequency, the new wavelength, and the angle of refraction in degrees. */
export function refractWave(
  wave: {
    readonly incidence: number;
    readonly speed: number;
    readonly wavelength: number;
  },
  speed: number
) {
  const frequency = wave.speed / wave.wavelength;
  const bent = (speed / wave.speed) * Math.sin(wave.incidence * DEGREE);
  return {
    frequency,
    refraction: Math.asin(Math.min(bent, 1)) / DEGREE,
    wavelength: speed / frequency,
  };
}

/** The spacing of the loud or bright points on a line `distance` from two sources `separation` apart, in the unit of `wavelength`. */
export function fringeSpacing(
  wavelength: number,
  separation: number,
  distance: number
) {
  return (wavelength * distance) / separation;
}

/** How many bright fringes lie from one bright fringe to another `span` away, both included, for fringes `spacing` apart. */
export function fringesInSpan(span: number, spacing: number) {
  return Math.floor(span / spacing + 1e-9) + 1;
}

/**
 * The intensity, from 0 to 1, at a point `along` the line, measured from the
 * point straight opposite the middle of two sources `separation` apart and
 * `distance` away, for a wavelength `wavelength`, from the exact path
 * difference between the two sources.
 */
export function twoSourceIntensity(
  sources: {
    readonly distance: number;
    readonly separation: number;
    readonly wavelength: number;
  },
  along: number
) {
  const half = sources.separation / 2;
  const fromFirst = Math.hypot(sources.distance, along - half);
  const fromSecond = Math.hypot(sources.distance, along + half);
  const difference = fromSecond - fromFirst;
  return Math.cos((Math.PI * difference) / sources.wavelength) ** 2;
}

/** The positions of the loudest points between `-reach` and `reach` along the line, at whole-wavelength path differences. */
export function loudPoints(
  sources: {
    readonly distance: number;
    readonly separation: number;
    readonly wavelength: number;
  },
  reach: number
) {
  const most = Math.floor(sources.separation / sources.wavelength);
  const orders = Arr.makeBy(2 * most + 1, (index) => index - most);
  return Arr.filter(
    Arr.map(orders, (order) => {
      const difference = order * sources.wavelength;
      return Math.abs(difference) >= sources.separation
        ? Number.NaN
        : exactPoint(sources, difference);
    }),
    (along) => Number.isFinite(along) && Math.abs(along) <= reach
  );
}

/**
 * The point along the line where the path difference to the two sources is
 * exactly `difference`, found by bisection, since the difference grows
 * steadily along the line.
 */
function exactPoint(
  sources: { readonly distance: number; readonly separation: number },
  difference: number
) {
  const half = sources.separation / 2;
  const gap = (along: number) =>
    Math.hypot(sources.distance, along + half) -
    Math.hypot(sources.distance, along - half) -
    difference;
  let low = -1e6;
  let high = 1e6;
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    if (gap(middle) < 0) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/**
 * A boat sounds its horn while heading straight at a cliff and hears the
 * echo `time` seconds later. The sound goes to the cliff and back while the
 * boat moves forward, so the sound and the boat together cover twice the
 * starting distance.
 */
export function echo(boat: number, sound: number, time: number) {
  const start = ((sound + boat) * time) / 2;
  const travelled = boat * time;
  return {
    back: start - travelled,
    start,
    travelled,
  };
}
