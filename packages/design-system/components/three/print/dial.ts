import {
  graduate,
  ScaleSchema,
  shareAt,
} from "@repo/design-system/components/three/print/scale";
import type { Mark } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr, Schema } from "effect";

/**
 * A scale laid along an arc, as on the face of a voltmeter or a pressure
 * gauge: where each tick and number stands, and the angle at which a needle
 * points at a value, so the needle and the print can never disagree.
 */

/**
 * A dial as an author states it: the pivot its needle turns about, the
 * radius its ticks end at, its scale, and the angles at which the scale's
 * two ends stand, counter-clockwise from the x axis.
 */
const DialSchema = Schema.Struct({
  centre: Schema.Tuple([Schema.Finite, Schema.Finite]),
  radius: Schema.Finite,
  scale: ScaleSchema,
  sweep: Schema.Struct({ from: Schema.Finite, to: Schema.Finite }),
});
type Dial = typeof DialSchema.Type;

/** How the scale of a dial is printed: its ink, and whether its ticks carry numbers. */
const StyleSchema = Schema.Struct({
  ink: Schema.String,
  numbered: Schema.Boolean,
});

/** A numbered tick's length and width, and a short tick's, as shares of the dial's radius. */
const TICK = {
  major: { length: 0.2, width: 0.034 },
  minor: { length: 0.11, width: 0.02 },
} as const;

/** The height of a number, and how far from the pivot its middle stands, as shares of the radius. */
const NUMBER = { reach: 0.56, size: 0.2 } as const;

/** The angle at which a dial shows a value, held inside its sweep. */
export function dialAngle(dial: Dial, value: number): number {
  const share = shareAt(dial.scale, value);
  return dial.sweep.from + share * (dial.sweep.to - dial.sweep.from);
}

/** The place on the sheet a share of the radius out from the pivot, at an angle. */
function reach(dial: Dial, angle: number, share: number) {
  return [
    dial.centre[0] + Math.cos(angle) * dial.radius * share,
    dial.centre[1] + Math.sin(angle) * dial.radius * share,
  ] as const;
}

/**
 * The printed scale of a dial: a radial tick at every step, longer and
 * thicker at the numbered ones, and each number upright inside its tick.
 * A dial that measures nothing a number can honestly name prints its ticks alone.
 *
 * @param dial - The dial's pivot, radius, scale and sweep
 * @param format - How a number is written, in the reader's locale
 * @param style - The ink the scale is printed in, and whether it is numbered
 */
export function dialMarks(
  dial: Dial,
  format: (value: number, digits: number) => string,
  style: typeof StyleSchema.Type
): readonly Mark[] {
  return Arr.flatMap(graduate(dial.scale, format), (tick): readonly Mark[] => {
    const angle = dialAngle(dial, tick.value);
    const shape = tick.major ? TICK.major : TICK.minor;
    const stroke: Mark = {
      from: reach(dial, angle, 1 - shape.length),
      ink: style.ink,
      kind: "line",
      to: reach(dial, angle, 1),
      width: dial.radius * shape.width,
    };
    if (!(tick.major && style.numbered)) {
      return [stroke];
    }
    return [
      stroke,
      {
        align: "middle",
        at: reach(dial, angle, NUMBER.reach),
        face: "sans",
        ink: style.ink,
        kind: "text",
        size: dial.radius * NUMBER.size,
        text: tick.label,
        turn: 0,
        weight: 700,
      },
    ];
  });
}
