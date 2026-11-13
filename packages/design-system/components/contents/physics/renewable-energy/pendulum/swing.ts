import { Array as Arr, Schema } from "effect";

/**
 * A 1 kg bob on a 2 m string, let go from 40°. Gravity trades potential
 * energy for kinetic energy and back; air drag, a force against the motion,
 * hands energy to the surroundings as heat. The swing is integrated with a
 * fourth-order Runge-Kutta step, and the heat with it, so the three stores
 * always add up to the energy the bob started with.
 */

/** The gravitational field strength, in metres per second squared. */
const GRAVITY = 9.8;

/** The string's length, in metres. */
export const LENGTH = 2;

/** The bob's mass, in kilograms. */
const MASS = 1;

/** The angle the bob is let go from, in radians. */
export const RELEASE = (40 * Math.PI) / 180;

/** The time step of the integration, in seconds. */
export const STEP = 1 / 240;

/** How long one run lasts, in seconds. */
export const DURATION = 12;

/** How hard the air drags on the bob. */
export const DragSchema = Schema.Literals(["none", "light", "strong"]);
export type Drag = typeof DragSchema.Type;

/** The damping rate of each drag, in reciprocal seconds: the angular deceleration per unit angular speed. */
const DAMPING = {
  light: 0.08,
  none: 0,
  strong: 0.35,
} as const satisfies Record<Drag, number>;

/** One moment of the swing: the angle, the angular speed and the heat handed to the air so far. */
const SwingSchema = Schema.Struct({
  angle: Schema.Finite,
  heat: Schema.Finite,
  spin: Schema.Finite,
});
export type Swing = typeof SwingSchema.Type;

/** The bob at rest at its release angle, before any heat. */
const RELEASED: Swing = { angle: RELEASE, heat: 0, spin: 0 };

/** The energy the bob starts with, all of it potential, in joules. */
export const START_ENERGY = MASS * GRAVITY * LENGTH * (1 - Math.cos(RELEASE));

/** How fast each part of the state changes: the swing's equation of motion and the power drag dissipates. */
function rates(state: Swing, damping: number): Swing {
  return {
    angle: state.spin,
    heat: damping * MASS * LENGTH * LENGTH * state.spin * state.spin,
    spin: -(GRAVITY / LENGTH) * Math.sin(state.angle) - damping * state.spin,
  };
}

/** Moves the state by `step` along `slope`. */
function shift(state: Swing, slope: Swing, step: number): Swing {
  return {
    angle: state.angle + slope.angle * step,
    heat: state.heat + slope.heat * step,
    spin: state.spin + slope.spin * step,
  };
}

/** One Runge-Kutta step of the swing and its heat. */
function advance(state: Swing, damping: number): Swing {
  const first = rates(state, damping);
  const second = rates(shift(state, first, STEP / 2), damping);
  const third = rates(shift(state, second, STEP / 2), damping);
  const fourth = rates(shift(state, third, STEP), damping);
  const blend = (part: keyof Swing) =>
    state[part] +
    (STEP / 6) *
      (first[part] + 2 * second[part] + 2 * third[part] + fourth[part]);
  return { angle: blend("angle"), heat: blend("heat"), spin: blend("spin") };
}

/** The whole run, one state per step, from the release to the end. */
export function simulateSwing(drag: Drag) {
  const steps = Math.round(DURATION / STEP);
  return Arr.scan(
    Arr.makeBy(steps, () => 0),
    RELEASED,
    (state) => advance(state, DAMPING[drag])
  );
}

/** The three stores at one moment, in joules. */
export function swingEnergies(state: Swing) {
  return {
    heat: state.heat,
    kinetic: 0.5 * MASS * LENGTH * LENGTH * state.spin * state.spin,
    potential: MASS * GRAVITY * LENGTH * (1 - Math.cos(state.angle)),
  };
}

/** The state at `time` seconds into the run. */
export function swingAt(run: readonly Swing[], time: number) {
  const index = Math.min(Math.max(Math.round(time / STEP), 0), run.length - 1);
  return Arr.getUnsafe(run, index);
}
