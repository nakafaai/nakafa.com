import type {
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  EnergySchema,
  energyOf,
  GasStateSchema,
  stateAlong,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/**
 * What the cylinder shows of a state, in metres: the gas column under the
 * piston, as tall as the gas's volume needs; how warm the gas looks; where
 * its molecules fly; and how a play moves the gas along its process.
 */

/** The glass cylinder: its inner radius and height, and the tallest column of gas it holds, at the volume axis's end. */
export const CYLINDER = { column: 0.2, height: 0.25, radius: 0.045 } as const;

/** The gas at one moment: how far along its process, its state, the energies so far, and whether the card plays. */
const GasMomentSchema = Schema.Struct({
  energy: EnergySchema,
  playing: Schema.Boolean,
  share: Schema.Finite,
  state: GasStateSchema,
});
export type GasMoment = typeof GasMomentSchema.Type;

/** The coldest and hottest of some states, which the gas's tint runs between. */
export function temperatureSpan(states: readonly GasState[]) {
  return Arr.reduce(
    states,
    { high: Number.NEGATIVE_INFINITY, low: Number.POSITIVE_INFINITY },
    (span, state) => ({
      high: Math.max(span.high, state.temperature),
      low: Math.min(span.low, state.temperature),
    })
  );
}

/** How long one play of a process takes, in seconds. */
export const PLAY_SECONDS = 3.2;

/** How many molecules fly in the gas; the amount of gas never changes. */
export const MOLECULES = 42;

/** How tall the gas column stands at `volume`, the cylinder's area being fixed: the column grows with the volume. */
export function columnHeight(volume: number, largest: number) {
  return (volume / largest) * CYLINDER.column;
}

/**
 * How warm the gas looks, from 0 at the coldest state the lab can reach to
 * 1 at the hottest; halfway when every state has one temperature.
 */
export function warmth(
  temperature: number,
  span: { readonly high: number; readonly low: number }
) {
  if (span.high - span.low < 1e-9) {
    return 0.5;
  }
  return Math.min(
    1,
    Math.max(0, (temperature - span.low) / (span.high - span.low))
  );
}

/** How far along its process the gas is `time` seconds into a play, 0 to 1, easing out of the start and into the end. */
export function playShare(time: number) {
  const share = Math.min(1, Math.max(0, time / PLAY_SECONDS));
  return share * share * (3 - 2 * share);
}

/** The gas a share `share`, 0 to 1, of the way along its process from `start` to `end`. */
export function momentAt(
  process: GasProcess,
  ends: { readonly end: GasState; readonly start: GasState },
  gamma: number,
  moment: { readonly playing: boolean; readonly share: number }
): GasMoment {
  const state = stateAlong(process, ends.start, ends.end, gamma, moment.share);
  return {
    energy: energyOf(process, ends.start, state, gamma),
    playing: moment.playing,
    share: moment.share,
    state,
  };
}

/** How fast the molecules fly at `temperature`, against their pace at `base`: their speed grows with the square root of the absolute temperature. */
export function moleculePace(temperature: number, base: number) {
  return Math.sqrt(temperature / base);
}

/**
 * Where molecule `index` is after flying for `clock`, in metres from the
 * middle of the gas's floor: inside a square across the bore, from the floor
 * to the piston `height` above it. Each crosses at its own pace and turns
 * back off the walls, the piston and the floor.
 */
export function moleculePlace(index: number, clock: number, height: number) {
  const bounce = (seed: number) => {
    const travel =
      (hashUnit(index, seed) + clock * (0.5 + hashUnit(index, seed + 1))) % 2;
    return travel < 1 ? travel : 2 - travel;
  };
  const across = 1.3 * CYLINDER.radius;
  return {
    x: (bounce(0) - 0.5) * across,
    y: 0.005 + bounce(2) * Math.max(height - 0.01, 0),
    z: (bounce(4) - 0.5) * across,
  };
}

/** The shortest an energy arrow shows, in metres, so a small energy still points its way. */
const SHORTEST_ARROW = 0.014;

/**
 * Where an energy arrow starts and ends along its own axis, in metres: as
 * long as the energy, `longest` at the lab's largest, never too short to
 * see, and pointing the way the energy flows; none for no energy. An arrow
 * at the wall ends at the wall while heat flows in and starts there while it
 * flows out; an arrow at the piston stands on its middle.
 */
export function arrowSpan(
  energy: number,
  scale: number,
  longest: number,
  anchor: "middle" | "wall"
) {
  const size =
    Math.abs(energy) <= scale * 1e-9
      ? 0
      : Math.max(SHORTEST_ARROW, (Math.abs(energy) / scale) * longest);
  const way = energy >= 0 ? 1 : -1;
  if (anchor === "wall") {
    return way > 0 ? { from: -size, to: 0 } : { from: 0, to: -size };
  }
  return { from: (-way * size) / 2, to: (way * size) / 2 };
}

/**
 * How the plate under the cylinder glows: it heats or cools an isobaric or
 * isochoric gas, brighter the more heat it passes, frosting when it takes
 * heat out; the other processes leave it dark.
 */
export function plateGlow(process: GasProcess, heat: number, scale: number) {
  const passes = process === "isobaric" || process === "isochoric";
  return {
    cold: heat < 0,
    strength: passes && scale > 0 ? (Math.abs(heat) / scale) * 1.4 : 0,
  };
}
