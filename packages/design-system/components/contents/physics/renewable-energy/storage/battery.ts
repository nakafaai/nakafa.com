import { Array as Arr, Schema } from "effect";

/**
 * A village health post on solar power with a battery. The 3 kWp roof follows
 * half a sine wave from 06:00 to 18:00; the vaccine fridge draws 0.4 kW all
 * day and lights and equipment add 1 kW from 18:00 to 22:00. Spare sunlight
 * charges the battery, and the battery covers the night until it runs empty.
 * Each way through the battery keeps 95% of the energy. The run repeats the
 * same day until the battery starts each day where it ended the day before.
 */

/** The roof's peak power at noon, in kilowatts. */
export const SOLAR_PEAK = 3;

/** The fridge's steady power, in kilowatts. */
const BASE_LOAD = 0.4;

/** The lights' and equipment's power from 18:00 to 22:00, in kilowatts. */
const EVENING_LOAD = 1;

/** The share of energy kept on the way into the battery, and again on the way out. */
const WAY_EFFICIENCY = 0.95;

/** The battery sizes on offer, in kilowatt-hours. */
export const BATTERY_SIZES = [5, 10, 15] as const;

/** The time step of the run, in hours. */
export const STEP = 0.1;

/** The steps in one day. */
const DAY_STEPS = Math.round(24 / STEP);

/** The days the run repeats before it reads the last one. */
const WARM_UP_DAYS = 3;

/** The roof's power at `hour`, in kilowatts. */
export function solarPower(hour: number) {
  return hour > 6 && hour < 18
    ? SOLAR_PEAK * Math.sin(((hour - 6) / 12) * Math.PI)
    : 0;
}

/** The health post's demand at `hour`, in kilowatts. */
export function demand(hour: number) {
  return BASE_LOAD + (hour >= 18 && hour < 22 ? EVENING_LOAD : 0);
}

/** One step of the battery's day: its charge at the end, and the energy it could not supply, in kilowatt-hours. */
const StorageStepSchema = Schema.Struct({
  charge: Schema.Finite,
  unmet: Schema.Finite,
});
type StorageStep = typeof StorageStepSchema.Type;

/** Moves the battery through one step starting at `hour`. */
function advance(charge: number, hour: number, size: number): StorageStep {
  const surplus =
    (solarPower(hour + STEP / 2) - demand(hour + STEP / 2)) * STEP;
  if (surplus >= 0) {
    return {
      charge: Math.min(size, charge + surplus * WAY_EFFICIENCY),
      unmet: 0,
    };
  }
  const drawn = Math.min(charge, -surplus / WAY_EFFICIENCY);
  return { charge: charge - drawn, unmet: -surplus - drawn * WAY_EFFICIENCY };
}

/** The battery's charge at every step of a settled day, and the energy left unsupplied that day. */
export function storageDay(size: number) {
  const hours = Arr.makeBy(
    WARM_UP_DAYS * DAY_STEPS,
    (step) => (step % DAY_STEPS) * STEP
  );
  const start: StorageStep = { charge: size / 2, unmet: 0 };
  const run = Arr.scan(hours, start, (state, hour) =>
    advance(state.charge, hour, size)
  );
  const day = Arr.takeRight(run, DAY_STEPS);
  return {
    charges: Arr.map(day, (step) => step.charge),
    unmet: Arr.reduce(day, 0, (sum, step) => sum + step.unmet),
  };
}

/** The roof's energy over a day, in kilowatt-hours. */
export function solarEnergy() {
  return Arr.reduce(
    Arr.makeBy(DAY_STEPS, (step) => solarPower(step * STEP + STEP / 2) * STEP),
    0,
    (sum, energy) => sum + energy
  );
}

/** The health post's energy use over a day, in kilowatt-hours. */
export function demandEnergy() {
  return Arr.reduce(
    Arr.makeBy(DAY_STEPS, (step) => demand(step * STEP + STEP / 2) * STEP),
    0,
    (sum, energy) => sum + energy
  );
}
