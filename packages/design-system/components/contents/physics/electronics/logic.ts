import { Match, Schema } from "effect";

/**
 * Electronics for the electronics labs. A logic gate turns two inputs of 0
 * or 1 into one output by its truth table. A potential divider shares a
 * supply between two resistors in proportion to their resistances. An npn
 * transistor switches on once its base-emitter voltage reaches about
 * 0.7 V; then its collector current is its base current times its current
 * gain, until the transistor saturates and the collector-emitter voltage can
 * fall no lower.
 */

/** The two-input logic gates the labs offer. */
export const GateSchema = Schema.Literals(["AND", "OR", "NAND", "NOR", "XOR"]);
export type Gate = typeof GateSchema.Type;

/** The output of `gate` for inputs `a` and `b`, each 0 or 1. */
export function gateOutput(gate: Gate, a: number, b: number) {
  const and = a === 1 && b === 1;
  const or = a === 1 || b === 1;
  const high = Match.value(gate).pipe(
    Match.when("AND", () => and),
    Match.when("OR", () => or),
    Match.when("NAND", () => !and),
    Match.when("NOR", () => !or),
    Match.when("XOR", () => a !== b),
    Match.exhaustive
  );
  return high ? 1 : 0;
}

/** The base voltage of a divider: the supply shared between the fixed resistor above and the lower arm, in volts. */
export function dividerVoltage(supply: number, upper: number, lower: number) {
  return (supply * lower) / (upper + lower);
}

/** The collector-emitter voltage below which a switched-on transistor is saturated, in volts. */
const SATURATION = 0.2;

/**
 * An npn transistor biased through a base resistor: its base current, its
 * collector current and its collector-emitter voltage, or the saturated
 * values once the collector resistor takes almost all of the supply.
 */
export function transistorBias(circuit: {
  readonly base: number;
  readonly baseSupply: number;
  readonly collector: number;
  readonly collectorSupply: number;
  readonly gain: number;
  readonly threshold: number;
}) {
  const baseCurrent = Math.max(
    0,
    (circuit.baseSupply - circuit.threshold) / circuit.base
  );
  const active = baseCurrent * circuit.gain;
  const most = (circuit.collectorSupply - SATURATION) / circuit.collector;
  const saturated = active > most;
  const collectorCurrent = saturated ? most : active;
  return {
    baseCurrent,
    collectorCurrent,
    collectorEmitter:
      circuit.collectorSupply - collectorCurrent * circuit.collector,
    saturated,
  };
}
