import { Array as Arr, Option } from "effect";
import { unitOf } from "@/lib/island/noise";
import type { Light } from "@/lib/island/sky";

/**
 * The lightning of a storm (ADR 0047, D33): where and when it strikes, how it
 * lights the sky, and when its thunder arrives. The strikes come from the
 * time alone, so the painter that flashes the sky and the sound that rumbles
 * after it agree without talking to each other.
 */

/** Seconds of one slot of the storm; each slot holds at most one strike, so strikes come about eleven seconds apart. */
const SLOT = 9;

/** The share of slots that hold a strike. */
const CHANCE = 0.8;

/** The nearest and the farthest a strike lands, in meters. */
const NEAREST = 400;
const FARTHEST = 4000;

/** How fast sound travels in air, in meters a second. */
const SOUND = 343;

/** One strike: the second it lands, how far away in meters, and the bearing it lies at, in radians. */
function strikeIn(slot: number) {
  if (unitOf(91, slot, 3) >= CHANCE) {
    return Option.none();
  }
  return Option.some({
    at: slot * SLOT + unitOf(91, slot, 0) * (SLOT - 1),
    bearing: unitOf(91, slot, 2) * Math.PI * 2,
    // Far strikes are more common than near ones.
    distance: NEAREST + unitOf(91, slot, 1) ** 1.5 * (FARTHEST - NEAREST),
  });
}

/** The latest strike at or before `time` seconds, none before the storm's first. */
export function lastStrike(time: number) {
  const slot = Math.floor(time / SLOT);
  return Option.orElse(
    Option.filter(strikeIn(slot), (strike) => strike.at <= time),
    () => strikeIn(slot - 1)
  );
}

/** How near a strike is, from a quarter for the farthest to 1 for the nearest. */
function nearnessOf(distance: number) {
  return 1 - (0.75 * (distance - NEAREST)) / (FARTHEST - NEAREST);
}

/**
 * How bright the sky flashes at `time` seconds, from 0 to 1: a stroke, a
 * flicker of darkness, a return stroke, then the glow dying away, all within
 * half a second, and brighter for a nearer strike.
 */
export function flashOf(time: number) {
  return Option.match(lastStrike(time), {
    onNone: () => 0,
    onSome: (strike) => {
      const since = time - strike.at;
      const near = nearnessOf(strike.distance);
      if (since < 0.07) {
        return near;
      }
      if (since < 0.12) {
        return 0.25 * near;
      }
      if (since < 0.2) {
        return 0.75 * near;
      }
      return Math.max(0, 0.75 * near * (1 - (since - 0.2) / 0.35));
    },
  });
}

/** The color between `a` and `b`, `t` of the way. */
function toward(a: readonly number[], b: readonly number[], t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ] as const;
}

/** The light while the sky flashes: the sky and the shade turn a cold white, the sun stays as it was. */
export function flashed(light: Light, flash: number): Light {
  const sky = [0.86, 0.88, 1] as const;
  const horizon = toward(light.horizon, sky, flash * 0.7);
  return {
    ...light,
    ambient: toward(light.ambient, [0.62, 0.64, 0.78], flash * 0.6),
    horizon,
    zenith: toward(light.zenith, sky, flash * 0.55),
  };
}

/**
 * The thunder of a strike (ADR 0050, W8): the second it arrives, as sound
 * crosses the distance; how loud the recording of it plays; and how fast, a
 * crack as recorded for a near strike and a slower, deeper and longer roll
 * for a far one.
 */
function thunderOf(strike: Option.Option.Value<ReturnType<typeof lastStrike>>) {
  const near = nearnessOf(strike.distance);
  return {
    at: strike.at + strike.distance / SOUND,
    loud: 0.25 + 0.75 * near,
    rate: 0.7 + 0.4 * near,
  };
}

/** Every strike whose thunder arrives between two seconds, the order they come in. */
export function thundersBetween(from: number, to: number) {
  const first = Math.floor((from - FARTHEST / SOUND) / SLOT);
  const last = Math.floor(to / SLOT);
  return Arr.getSomes(
    Arr.map(Arr.range(first, last), (slot) =>
      Option.filter(
        Option.map(strikeIn(slot), thunderOf),
        (thunder) => thunder.at > from && thunder.at <= to
      )
    )
  );
}
