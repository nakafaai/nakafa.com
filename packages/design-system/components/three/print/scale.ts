import { Array as Arr, Option, Schema } from "effect";

/**
 * The mathematics of a graduated scale: which values carry a tick, which of
 * them are numbered, where each stands between the two ends, and how a
 * number is written. A dial, a ruler and the side of a beaker all lay the
 * same ticks out, each along its own path.
 */

/**
 * A scale as an author states it: it runs from one value to another, with a
 * numbered tick at every multiple of `major` and, when `minor` is given, a
 * short tick at every multiple of `minor` between them. `from` may be the
 * larger end, for a scale that reads downwards.
 */
export const ScaleSchema = Schema.Struct({
  from: Schema.Finite,
  major: Schema.Finite,
  minor: Schema.optionalKey(Schema.Finite),
  to: Schema.Finite,
});
type Scale = typeof ScaleSchema.Type;

/**
 * One tick: its value, how far along the scale it stands from 0 at `from`
 * to 1 at `to`, whether it is a numbered one, and its number as printed,
 * which is empty for a short tick.
 */
const TickSchema = Schema.Struct({
  label: Schema.String,
  major: Schema.Boolean,
  share: Schema.Finite,
  value: Schema.Finite,
});
type Tick = typeof TickSchema.Type;

/** How a number is written with a given count of decimals, in the reader's locale. */
type Format = (value: number, digits: number) => string;

/** How close two values must be to count as one, as a share of a step. */
const NEAR = 1e-6;

/** The most decimals a step is read to. */
const DECIMALS = 6;

/** How many decimals a step needs to be written exactly: 0 for 50, 2 for 0.25. */
export function digitsOf(step: number): number {
  return Option.getOrElse(
    Arr.findFirst(Arr.range(0, DECIMALS), (digits) => {
      const scaled = Math.abs(step) * 10 ** digits;
      return Math.abs(scaled - Math.round(scaled)) < NEAR;
    }),
    () => DECIMALS
  );
}

/** How far along a scale a value stands, from 0 at `from` to 1 at `to`, held inside the scale. */
export function shareAt(scale: Scale, value: number): number {
  const span = scale.to - scale.from;
  if (span === 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - scale.from) / span));
}

/**
 * The ticks of a scale, from its low end to its high end: one at every
 * multiple of its finest step inside the scale, numbered at the multiples of
 * `major`. A number is written through `format` with the decimals its major
 * step needs, so a scale in steps of 0.5 reads 0.5, 1.0, 1.5 and a reader
 * abroad sees their own decimal mark.
 */
export function graduate(scale: Scale, format: Format): readonly Tick[] {
  const step = Math.abs(scale.minor ?? scale.major);
  const major = Math.abs(scale.major);
  const low = Math.min(scale.from, scale.to);
  const high = Math.max(scale.from, scale.to);
  if (!(step > 0 && major > 0)) {
    return [];
  }
  const first = Math.ceil(low / step - NEAR);
  const last = Math.floor(high / step + NEAR);
  const digits = digitsOf(major);
  if (last < first) {
    return [];
  }
  return Arr.map(Arr.range(first, last), (index) => {
    const value = Number((index * step).toFixed(DECIMALS + 3));
    const turns = value / major;
    const numbered = Math.abs(turns - Math.round(turns)) < NEAR;
    return {
      label: numbered ? format(value, digits) : "",
      major: numbered,
      share: shareAt(scale, value),
      value,
    };
  });
}
