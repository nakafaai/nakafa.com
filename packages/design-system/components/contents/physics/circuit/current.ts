import { Array as Arr, Schema } from "effect";

/**
 * Direct-current circuits for the electricity labs. A resistor obeys
 * V = I R; a real cell has an e.m.f. E and an internal resistance r, so its
 * terminal voltage falls as it delivers current, V = E − I r. Resistors in
 * series add, and in parallel their reciprocals add. A bulb's brightness
 * follows its power, P = V² / R, and a heater on another voltage keeps its
 * resistance, not its power. A wire's resistance grows with its length and
 * falls with its cross-sectional area, R ∝ l / A.
 */

/** A measured reading of a cell driving one external resistor: the resistance in ohms and the terminal voltage in volts. */
export function cellFromReadings(
  first: { readonly resistance: number; readonly voltage: number },
  second: { readonly resistance: number; readonly voltage: number }
) {
  const currentOne = first.voltage / first.resistance;
  const currentTwo = second.voltage / second.resistance;
  const internal = (first.voltage - second.voltage) / (currentTwo - currentOne);
  return { emf: first.voltage + currentOne * internal, internal };
}

/** The current and terminal voltage when a cell of e.m.f. `emf` and internal resistance `internal` drives `resistance`. */
export function drive(
  cell: { readonly emf: number; readonly internal: number },
  resistance: number
) {
  const current = cell.emf / (resistance + cell.internal);
  return { current, voltage: current * resistance };
}

/** The resistance of resistors in parallel, from the sum of their reciprocals. */
export function parallel(resistances: readonly number[]) {
  return (
    1 / Arr.reduce(resistances, 0, (sum, resistance) => sum + 1 / resistance)
  );
}

/** One bulb of a parallel group: whether its filament is broken, and its resistance in ohms. */
const GroupBulbSchema = Schema.Struct({
  broken: Schema.Boolean,
  resistance: Schema.Finite,
});
type GroupBulb = typeof GroupBulbSchema.Type;

/**
 * A bulb in series with a group of bulbs in parallel, on a supply of
 * negligible internal resistance. A broken bulb carries no current, so it
 * drops out of its group. Each bulb's voltage, current and power, the series
 * bulb first.
 */
export function bulbNetwork(
  emf: number,
  series: number,
  group: readonly GroupBulb[]
) {
  const working = Arr.filter(group, (bulb) => !bulb.broken);
  const shared = Arr.isReadonlyArrayNonEmpty(working)
    ? parallel(Arr.map(working, (bulb) => bulb.resistance))
    : Number.POSITIVE_INFINITY;
  const current = emf / (series + shared);
  const across = Number.isFinite(shared) ? current * shared : emf;
  const seriesVoltage = current * series;
  const seriesBulb = {
    current,
    power: seriesVoltage * current,
    voltage: seriesVoltage,
  };
  const groupBulbs = Arr.map(group, (bulb) => {
    const flowing = bulb.broken ? 0 : across / bulb.resistance;
    return { current: flowing, power: across * flowing, voltage: across };
  });
  return { bulbs: [seriesBulb, ...groupBulbs], current };
}

/** A heater rated for `rated` volts and watts on another supply: its fixed resistance, its power there, and the energy in kilowatt-hours over `hours`. */
export function heaterOnSupply(
  rated: { readonly power: number; readonly voltage: number },
  supply: number,
  hours: number
) {
  const resistance = rated.voltage ** 2 / rated.power;
  const power = supply ** 2 / resistance;
  return { energy: (power / 1000) * hours, power, resistance };
}

/** How a second wire of the same material compares with the first at a fixed voltage, from the ratios of its length and diameter. */
export function wireRatios(length: number, diameter: number) {
  const area = diameter ** 2;
  const resistance = length / area;
  return { area, power: 1 / resistance, resistance };
}
