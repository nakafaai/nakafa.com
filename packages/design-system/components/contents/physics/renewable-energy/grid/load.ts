import { Array as Arr, Schema } from "effect";

/**
 * A day of electricity demand in a village of 100 homes on a 50 kW mini-grid.
 * Every home follows the same illustrative pattern, low at night and highest
 * in the evening, and each runs a 0.4 kW rice cooker for one hour. If every
 * home cooks at 18:00, the evening peak passes what the grid can supply; if
 * the cooking is spread from 16:00 to 20:00, the same energy fits.
 */

/** The homes in the village. */
export const HOMES = 100;

/** The most power the mini-grid can supply at once, in kilowatts. */
export const CAPACITY = 50;

/** One rice cooker's power, in kilowatts, run for one hour a day. */
export const COOKER = 0.4;

/** Each home's demand in every hour of the day without the cooker, in kilowatts. */
export const HOME_LOAD = [
  0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.15, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
  0.1, 0.1, 0.1, 0.15, 0.25, 0.25, 0.25, 0.25, 0.1, 0.1,
] as const;

/** When the village cooks: all at 18:00, or a quarter of the homes in each hour from 16:00 to 20:00. */
export const ScheduleSchema = Schema.Literals(["together", "spread"]);
export type Schedule = typeof ScheduleSchema.Type;

/** The share of the homes cooking in each hour under each schedule. */
const COOKING_SHARE = {
  spread: (hour: number) => (hour >= 16 && hour < 20 ? 0.25 : 0),
  together: (hour: number) => (hour === 18 ? 1 : 0),
} as const satisfies Record<Schedule, (hour: number) => number>;

/** The village's demand in each hour of the day, in kilowatts. */
export function villageLoad(schedule: Schedule) {
  return Arr.map(
    HOME_LOAD,
    (load, hour) => HOMES * (load + COOKER * COOKING_SHARE[schedule](hour))
  );
}

/** The village's energy over the day, in kilowatt-hours: each hour's power times one hour. */
export function dailyEnergy(schedule: Schedule) {
  return Arr.reduce(villageLoad(schedule), 0, (sum, power) => sum + power);
}

/** The highest demand of the day, in kilowatts. */
export function peakLoad(schedule: Schedule) {
  return Math.max(...villageLoad(schedule));
}

/** The hours when demand passes what the grid can supply. */
export function hoursOver(schedule: Schedule) {
  return Arr.filter(villageLoad(schedule), (power) => power > CAPACITY + 1e-9)
    .length;
}
