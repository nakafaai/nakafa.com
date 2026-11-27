import { refractWave } from "@repo/design-system/components/contents/physics/waves/wave";
import { Schema } from "effect";

/**
 * The surface of a ripple tank with a step in its depth. A straight wave
 * that crosses the step keeps its frequency, so its phase is continuous
 * along the boundary: the part of its wave vector along the boundary is the
 * same on both sides, which is Snell's law, and the wave vector grows by the
 * ratio of the two speeds, which is the shorter wavelength. The water's
 * height is the cosine of that phase, a solution of the wave equation on
 * each side that matches along the step.
 */

const DEGREE = Math.PI / 180;

/** A straight wave in the deep water: its angle of incidence in degrees, its speed, and its wavelength. */
const WaveSchema = Schema.Struct({
  incidence: Schema.Finite,
  speed: Schema.Finite,
  wavelength: Schema.Finite,
});

/**
 * The wave vectors of the wave on both sides of the step, in radians per
 * scene unit, as their parts along the boundary and across it, from the
 * deep water into the shallow.
 *
 * @param wave - The wave in the deep water
 * @param speed - The wave speed in the shallow water
 * @param unit - How many scene units one unit of the wavelength takes
 */
export function waveVectors(
  wave: typeof WaveSchema.Type,
  speed: number,
  unit: number
) {
  const shallow = refractWave(wave, speed);
  const deep = (2 * Math.PI) / (wave.wavelength * unit);
  const slow = (2 * Math.PI) / (shallow.wavelength * unit);
  return {
    deep: [
      deep * Math.sin(wave.incidence * DEGREE),
      deep * Math.cos(wave.incidence * DEGREE),
    ] as const,
    shallow: [
      slow * Math.sin(shallow.refraction * DEGREE),
      slow * Math.cos(shallow.refraction * DEGREE),
    ] as const,
  };
}
