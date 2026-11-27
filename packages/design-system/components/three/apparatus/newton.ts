import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import { words } from "@repo/design-system/components/three/print/sheet";

/**
 * A newton meter: a spring in a clear barrel that stretches in proportion
 * to the force on its hook, Hooke's law, so a pointer on its rod reads the
 * force off a scale printed evenly along the barrel.
 */

/** How many numbered steps the scale of a newton meter has. */
const STEPS = 4;

/**
 * The sizes of a newton meter: the length and radius of its clear barrel,
 * how far its pointer travels from zero to the end of the scale, how far
 * the mouth of the barrel is from the eye of the hook with no force on it,
 * how far inside the mouth the zero of the scale stands, and how far its
 * ring reaches beyond the barrel.
 */
export const NEWTON_METER = {
  lead: 0.1,
  long: 0.62,
  radius: 0.07,
  ring: 0.11,
  travel: 0.3,
  zero: 0.37,
} as const;

/**
 * How far the spring of a newton meter is stretched by `force`, on a meter
 * that reads up to `most` over a scale `travel` long. A force beyond the
 * scale holds the pointer at its end, as the stop of a real meter does, and
 * a push leaves it at zero.
 */
export function stretch(force: number, most: number, travel: number) {
  return (Math.min(Math.max(force, 0), most) / most) * travel;
}

/**
 * How far the end of a newton meter's ring is from the eye of its hook when
 * `force` pulls on a meter that reads up to `most`: the spring's stretch
 * draws the barrel that far away from the hook.
 */
export function meterReach(force: number, most: number) {
  return (
    NEWTON_METER.lead +
    stretch(force, most, NEWTON_METER.travel) +
    NEWTON_METER.long +
    NEWTON_METER.ring
  );
}

/**
 * The scale printed along the barrel of a newton meter, on a sheet that
 * wraps the barrel and runs along it: zero at the low end of the sheet's
 * run and `most` at its high end, `travel` apart, numbered in four steps
 * with five ticks to each, and the unit N beyond zero. The numbers are
 * turned to read along the barrel.
 *
 * @param meter - The largest force it reads, the length of its scale, and the width of the sheet round the barrel
 * @param ink - The colour of the print
 * @param format - How a number is written, in the reader's locale
 */
export function newtonSheet(
  meter: {
    readonly most: number;
    readonly travel: number;
    readonly wide: number;
  },
  ink: string,
  format: (value: number, digits: number) => string
) {
  const size = meter.wide * 0.3;
  const margin = size * 2.4;
  return {
    height: meter.travel + margin * 2,
    marks: [
      ...ruleMarks(
        {
          from: [-meter.wide * 0.3, -meter.travel / 2],
          scale: {
            from: 0,
            major: meter.most / STEPS,
            minor: meter.most / STEPS / 5,
            to: meter.most,
          },
          side: -1,
          to: [-meter.wide * 0.3, meter.travel / 2],
        },
        format,
        {
          ink,
          major: size * 0.9,
          minor: size * 0.5,
          size,
          turn: -Math.PI / 2,
          width: size * 0.09,
        }
      ),
      words({
        at: [meter.wide * 0.1, -meter.travel / 2 - margin * 0.6],
        ink,
        size,
        text: "N",
        turn: -Math.PI / 2,
      }),
    ],
    width: meter.wide,
  };
}
