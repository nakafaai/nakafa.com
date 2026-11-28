import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";

/**
 * A 100 mL glass gas syringe: a ground barrel with a nozzle at one end, a
 * scale from 0 at the nozzle to 100 at the open end, and a plunger the gas
 * pushes out. Every length is in metres along the syringe from the end of
 * its nozzle, and every volume in millilitres, so the plunger's travel and
 * the scale on the barrel agree: the plunger's face is at the mark of the
 * volume the syringe holds.
 */
export const SYRINGE = {
  /** The barrel's inner radius. */
  bore: 0.016,
  /** What its scale runs to. */
  capacity: 100,
  /** Where the barrel's open end is. */
  mouth: 0.178,
  /** The nozzle's outer radius. */
  nozzle: 0.004,
  /** The barrel's outer radius. */
  radius: 0.0176,
  /** Where the barrel's shoulder ends and its straight bore begins. */
  shoulder: 0.03,
  /** Where its zero mark is: the plunger's face when the syringe is empty. */
  zero: 0.034,
} as const;

/** A cubic metre in millilitres. */
const MILLILITRES = 1e6;

/** The sizes of the scale's parts, in metres. */
const SCALE = {
  major: 0.008,
  margin: 0.006,
  minor: 0.0045,
  size: 0.0042,
  stroke: 0.0005,
  width: 0.03,
} as const;

/**
 * How far the plunger's face stands from the zero mark when the syringe
 * holds a volume of gas: the length of bore that volume fills, held between
 * empty and the syringe's capacity.
 *
 * @param volume - The gas the syringe holds, in millilitres
 */
export function travelOf(volume: number) {
  const held = Math.min(Math.max(volume, 0), SYRINGE.capacity);
  return held / MILLILITRES / (Math.PI * SYRINGE.bore ** 2);
}

/**
 * The scale fired on a gas syringe: a mark at every 5 mL and a number at
 * every 20, 0 at the nozzle. `middle` is where the sheet's middle is along
 * the syringe.
 *
 * @param ink - The colour of the enamel
 * @param format - How a number is written, in the reader's locale
 */
export function scaleOf(
  ink: string,
  format: (value: number, digits: number) => string
) {
  const run = travelOf(SYRINGE.capacity);
  const left = -SCALE.width / 2 + 0.002;
  const sheet: Sheet = {
    height: run + SCALE.margin * 2,
    marks: ruleMarks(
      {
        from: [left, -run / 2],
        scale: { from: 0, major: 20, minor: 5, to: SYRINGE.capacity },
        side: -1,
        to: [left, run / 2],
      },
      format,
      {
        ink,
        major: SCALE.major,
        minor: SCALE.minor,
        size: SCALE.size,
        width: SCALE.stroke,
      }
    ),
    width: SCALE.width,
  };
  return { middle: SYRINGE.zero + run / 2, sheet };
}
