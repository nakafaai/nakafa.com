import { Array as Arr, Schema } from "effect";

/**
 * A prey and a predator population, as the Lotka-Volterra model writes them
 * (Lotka 1925, Volterra 1926), with the prey's growth limited by its food
 * when the field can feed only `capacity` of them:
 *
 *   dx/dt = growth x (1 - x / capacity) - catching x y
 *   dy/dt = converting x y - dying y
 *
 * The rates are per year, the populations are animals in one field.
 */
export const RatesSchema = Schema.Struct({
  capacity: Schema.Finite,
  catching: Schema.Finite,
  converting: Schema.Finite,
  dying: Schema.Finite,
  growth: Schema.Finite,
});
export type Rates = typeof RatesSchema.Type;

/** The prey and predators alive at one moment. */
export const HerdSchema = Schema.Struct({
  predators: Schema.Finite,
  prey: Schema.Finite,
});
export type Herd = typeof HerdSchema.Type;

/**
 * Rice-field rats and the barn owls that hunt them, in round teaching rates:
 * rats double fast when food is plenty, an owl eats a share of the rats it
 * meets, owls breed from what they eat and die off without it. With no limit
 * on food the two balance at 100 rats and 20 owls and cycle around it about
 * every four and a half years.
 */
export const FIELD = {
  capacity: Number.POSITIVE_INFINITY,
  catching: 0.1,
  converting: 0.01,
  dying: 1,
  growth: 2,
} as const satisfies Rates;

/** The populations the rates balance at, where neither changes. */
export function balanceOf(rates: Rates): Herd {
  const prey = rates.dying / rates.converting;
  const room = Number.isFinite(rates.capacity) ? 1 - prey / rates.capacity : 1;
  return {
    predators: Math.max(0, (rates.growth * room) / rates.catching),
    prey,
  };
}

/** How fast each population changes, in animals a year. */
export function rateOf(herd: Herd, rates: Rates): Herd {
  const room = Number.isFinite(rates.capacity)
    ? 1 - herd.prey / rates.capacity
    : 1;
  return {
    predators:
      rates.converting * herd.prey * herd.predators -
      rates.dying * herd.predators,
    prey:
      rates.growth * herd.prey * room -
      rates.catching * herd.prey * herd.predators,
  };
}

/** One fourth-order Runge-Kutta step of `years`. */
export function stepOf(herd: Herd, rates: Rates, years: number): Herd {
  const shift = (base: Herd, slope: Herd, share: number): Herd => ({
    predators: base.predators + slope.predators * share,
    prey: base.prey + slope.prey * share,
  });
  const k1 = rateOf(herd, rates);
  const k2 = rateOf(shift(herd, k1, years / 2), rates);
  const k3 = rateOf(shift(herd, k2, years / 2), rates);
  const k4 = rateOf(shift(herd, k3, years), rates);
  return {
    predators: Math.max(
      0,
      herd.predators +
        ((k1.predators + 2 * k2.predators + 2 * k3.predators + k4.predators) *
          years) /
          6
    ),
    prey: Math.max(
      0,
      herd.prey + ((k1.prey + 2 * k2.prey + 2 * k3.prey + k4.prey) * years) / 6
    ),
  };
}

/**
 * The populations every `every` years from a start, for `years` years, each
 * sample reached through steps of a hundredth of a year.
 */
export function historyOf(
  start: Herd,
  rates: Rates,
  years: number,
  every: number
) {
  const samples = Math.max(1, Math.round(years / every));
  const steps = Math.max(1, Math.round(every / 0.01));
  return Arr.scan(Arr.range(1, samples), start, (herd) =>
    Arr.reduce(Arr.range(1, steps), herd, (current) =>
      stepOf(current, rates, every / steps)
    )
  );
}

/**
 * The quantity the plain Lotka-Volterra model keeps constant along a cycle,
 * which shows a numerical run neither gains nor loses animals by error.
 */
export function cycleInvariant(herd: Herd, rates: Rates) {
  return (
    rates.converting * herd.prey -
    rates.dying * Math.log(herd.prey) +
    rates.catching * herd.predators -
    rates.growth * Math.log(herd.predators)
  );
}

/** The period of small cycles around the balance, in years: 2π over √(growth × dying). */
export function periodOf(rates: Rates) {
  return (2 * Math.PI) / Math.sqrt(rates.growth * rates.dying);
}
