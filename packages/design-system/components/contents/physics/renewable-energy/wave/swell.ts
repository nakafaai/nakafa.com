import { Schema } from "effect";

/**
 * Ocean waves in deep water and the power they carry toward a wave-energy
 * buoy. A regular wave of height H and period T carries ρ g² H² T / (64π)
 * watts across every metre of its crest, so twice the height brings four
 * times the power. Its length is g T² / (2π), and it travels one length each
 * period.
 */

/** The density of seawater, in kilograms per cubic metre. */
const SEAWATER_DENSITY = 1025;

/** The gravitational acceleration, in metres per second squared. */
const GRAVITY = 9.81;

/** The three sea states the buoy can face. */
export const SeaSchema = Schema.Literals(["calm", "moderate", "rough"]);
export type Sea = typeof SeaSchema.Type;

/** A regular wave's height in metres and period in seconds. */
const WaveSchema = Schema.Struct({
  height: Schema.Finite,
  period: Schema.Finite,
});

/** Each sea's wave height, trough to crest, in metres, and its period, in seconds. */
export const SEA_STATES = {
  calm: { height: 1, period: 6 },
  moderate: { height: 2, period: 8 },
  rough: { height: 3, period: 10 },
} as const satisfies Record<Sea, typeof WaveSchema.Type>;

/** The power the waves carry across one metre of crest, in watts. */
export function wavePower(sea: Sea) {
  const { height, period } = SEA_STATES[sea];
  return (
    (SEAWATER_DENSITY * GRAVITY * GRAVITY * height * height * period) /
    (64 * Math.PI)
  );
}

/** The distance from one crest to the next, in metres. */
export function wavelength(sea: Sea) {
  const { period } = SEA_STATES[sea];
  return (GRAVITY * period * period) / (2 * Math.PI);
}

/** How fast a crest moves across the sea, in metres per second. */
export function waveSpeed(sea: Sea) {
  return wavelength(sea) / SEA_STATES[sea].period;
}

/** The sea surface's height above still water at `distance` metres and `time` seconds, in metres. */
export function surfaceHeight(sea: Sea, distance: number, time: number) {
  const { height, period } = SEA_STATES[sea];
  const phase =
    (2 * Math.PI * distance) / wavelength(sea) - (2 * Math.PI * time) / period;
  return (height / 2) * Math.cos(phase);
}
