import { Array as Arr, Schema } from "effect";

/**
 * An ideal gas in a cylinder, taken through one of the four processes of
 * Fisika XI: at constant pressure, constant volume, constant temperature, or
 * with no heat at all. Pressure is in kilopascals and volume in litres, so
 * their product is in joules: one kilopascal times one litre is one joule.
 * Temperature is in kelvin. Every state keeps p V = n R T, and the first law
 * reads ΔU = Q − W, where Q is the heat that flows into the gas and W the
 * work the gas does on the piston.
 */

/** The molar gas constant, in J mol⁻¹ K⁻¹. */
const GAS_CONSTANT = 8.314;

/** The ratio of heat capacities γ = Cp / Cv of a monatomic ideal gas. */
export const MONATOMIC_GAMMA = 5 / 3;

/** The four processes, in the order the textbook teaches them. */
const GasProcessSchema = Schema.Literals([
  "isobaric",
  "isochoric",
  "isothermal",
  "adiabatic",
]);
export type GasProcess = typeof GasProcessSchema.Type;

/** One state of the gas: pressure in kPa, volume in L, temperature in K. */
export const GasStateSchema = Schema.Struct({
  pressure: Schema.Finite,
  temperature: Schema.Finite,
  volume: Schema.Finite,
});
export type GasState = typeof GasStateSchema.Type;

/** The state the gas starts in: its volume, and either its pressure or its temperature. */
const GasStartSchema = Schema.Union([
  Schema.Struct({ pressure: Schema.Finite, volume: Schema.Finite }),
  Schema.Struct({ temperature: Schema.Finite, volume: Schema.Finite }),
]);
export type GasStart = typeof GasStartSchema.Type;

/** Where the end of a process may be set, and where it is set at first. */
const EndRangeSchema = Schema.Struct({
  end: Schema.Finite,
  max: Schema.Finite,
  min: Schema.Finite,
});
export type EndRange = typeof EndRangeSchema.Type;

/**
 * One process the lab offers. The end of an isochoric process is a pressure
 * in kPa, since its volume cannot change; the end of every other process is
 * a volume in L.
 */
const GasProcessSetupSchema = Schema.Union([
  Schema.Struct({
    process: Schema.Literals(["isobaric", "isothermal", "adiabatic"]),
    volume: EndRangeSchema,
  }),
  Schema.Struct({
    pressure: EndRangeSchema,
    process: Schema.Literal("isochoric"),
  }),
]);
export type GasProcessSetup = typeof GasProcessSetupSchema.Type;

/** The heat into the gas Q, the work done by the gas W, and the change of its internal energy ΔU, in joules. */
export const EnergySchema = Schema.Struct({
  heat: Schema.Finite,
  internal: Schema.Finite,
  work: Schema.Finite,
});
export type Energy = typeof EnergySchema.Type;

/** The start state, its missing quantity found from p V = n R T. */
export function startState(moles: number, start: GasStart): GasState {
  const amount = moles * GAS_CONSTANT;
  if ("pressure" in start) {
    return {
      pressure: start.pressure,
      temperature: (start.pressure * start.volume) / amount,
      volume: start.volume,
    };
  }
  return {
    pressure: (amount * start.temperature) / start.volume,
    temperature: start.temperature,
    volume: start.volume,
  };
}

/** n R of the gas, in J K⁻¹, read from any one of its states. */
function amountOf(state: GasState) {
  return (state.pressure * state.volume) / state.temperature;
}

/** The quantity the learner sets to end a process: the volume, or the pressure of an isochoric one. */
export function endQuantity(process: GasProcess) {
  return process === "isochoric" ? "pressure" : "volume";
}

/** Where the end of an offered process may be set. */
export function rangeOf(setup: GasProcessSetup) {
  return setup.process === "isochoric" ? setup.pressure : setup.volume;
}

/** A state with this pressure and volume, its temperature from p V = n R T. */
function settled(start: GasState, pressure: number, volume: number) {
  return {
    pressure,
    temperature: (pressure * volume) / amountOf(start),
    volume,
  };
}

/** Where each process takes the gas when its end quantity is set to `end`. */
const ENDS: Readonly<
  Record<GasProcess, (start: GasState, end: number, gamma: number) => GasState>
> = {
  adiabatic: (start, volume, gamma) =>
    settled(start, start.pressure * (start.volume / volume) ** gamma, volume),
  isobaric: (start, volume) => settled(start, start.pressure, volume),
  isochoric: (start, pressure) => settled(start, pressure, start.volume),
  isothermal: (start, volume) => ({
    pressure: (start.pressure * start.volume) / volume,
    temperature: start.temperature,
    volume,
  }),
};

/** The state a process takes the gas to from `start` when its end quantity is set to `end`. */
export function endState(
  process: GasProcess,
  start: GasState,
  end: number,
  gamma: number
) {
  return ENDS[process](start, end, gamma);
}

/**
 * The state a share `progress`, 0 to 1, of the way along a process from
 * `start` to `end`, its end quantity changing evenly, as the piston or the
 * heater moves it.
 */
export function stateAlong(
  process: GasProcess,
  start: GasState,
  end: GasState,
  gamma: number,
  progress: number
) {
  const quantity = endQuantity(process);
  return endState(
    process,
    start,
    start[quantity] + (end[quantity] - start[quantity]) * progress,
    gamma
  );
}

/** The work the gas does in each process that lets heat in, in joules. */
const WORK: Readonly<
  Record<
    Exclude<GasProcess, "adiabatic">,
    (start: GasState, end: GasState) => number
  >
> = {
  isobaric: (start, end) => start.pressure * (end.volume - start.volume),
  isochoric: () => 0,
  isothermal: (start, end) =>
    start.pressure * start.volume * Math.log(end.volume / start.volume),
};

/**
 * Q, W and ΔU from `start` to `end`. ΔU = n Cv ΔT with Cv = R / (γ − 1),
 * which is (3/2) n R ΔT for a monatomic gas. An adiabatic process lets no
 * heat in, so its work is all paid from the internal energy; in every other
 * process the heat is what the first law asks, Q = ΔU + W.
 */
export function energyOf(
  process: GasProcess,
  start: GasState,
  end: GasState,
  gamma: number
): Energy {
  const internal =
    (amountOf(start) * (end.temperature - start.temperature)) / (gamma - 1);
  if (process === "adiabatic") {
    return { heat: 0, internal, work: -internal };
  }
  const work = WORK[process](start, end);
  return { heat: internal + work, internal, work };
}

/** The states at both ends of each offered process's range, as far as the gas can go. */
function farStates(
  setups: readonly GasProcessSetup[],
  start: GasState,
  gamma: number
) {
  return Arr.flatMap(setups, (setup) =>
    Arr.map([rangeOf(setup).min, rangeOf(setup).max], (end) => ({
      process: setup.process,
      state: endState(setup.process, start, end, gamma),
    }))
  );
}

/** The start and every state the offered processes can reach at the ends of their ranges. */
export function reachableStates(
  setups: readonly GasProcessSetup[],
  start: GasState,
  gamma: number
) {
  return Arr.prepend(
    Arr.map(farStates(setups, start, gamma), (far) => far.state),
    start
  );
}

/**
 * The largest size Q, W or ΔU reaches in any offered process, at either end
 * of its range, so the bars of every process share one scale and grow as the
 * learner moves the end.
 */
export function energyScale(
  setups: readonly GasProcessSetup[],
  start: GasState,
  gamma: number
) {
  return Arr.reduce(farStates(setups, start, gamma), 0, (most, far) => {
    const energy = energyOf(far.process, start, far.state, gamma);
    return Math.max(
      most,
      Math.abs(energy.heat),
      Math.abs(energy.internal),
      Math.abs(energy.work)
    );
  });
}
