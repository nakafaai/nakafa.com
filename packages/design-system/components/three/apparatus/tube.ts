import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr } from "effect";

/**
 * A 50 mL burette as ISO 385 makes it: a graduated tube read downward from
 * its zero mark, a stopcock under its 50 mL mark and a drawn-out tip. Every
 * height is in metres above the end of the tip, and every volume in
 * millilitres, so the level in the tube, the titrant that stands in it and
 * the scale on its wall all agree.
 */
export const BURETTE = {
  /** The tube's inner radius. */
  bore: 0.0054,
  /** What it delivers from its zero mark to its last. */
  capacity: 50,
  /** Its 50 mL mark. */
  full: 0.125,
  /** The tube's outer radius. */
  radius: 0.0065,
  /** Its stopcock's key. */
  stopcock: 0.045,
  /** Its open top. */
  top: 0.625,
  /** Its zero mark. */
  zero: 0.575,
} as const;

/** How high the titrant climbs the glass, and how far in from the wall its surface is flat again. */
const MENISCUS = { reach: 0.003, rise: 0.0011, steps: 5 } as const;

/** The sizes of the scale's parts, in metres. */
const SCALE = { major: 0.0075, minor: 0.0042, size: 0.0042, stroke: 0.0005 };

/** The scale's width on the tube's wall, and the margin above and below its end marks. */
const SLEEVE = { margin: 0.012, width: 0.022 } as const;

/**
 * The height of the meniscus when a burette reads a volume: at its zero
 * mark for 0, lower by the same distance for every millilitre run out, and
 * held between its two end marks.
 */
export function meniscusOf(reading: number) {
  const share = Math.min(1, Math.max(0, reading / BURETTE.capacity));
  return BURETTE.zero - share * (BURETTE.zero - BURETTE.full);
}

/**
 * The titrant that stands in a burette at a reading, as the outline of a
 * turned part: from the stopcock's key up the bore to its meniscus.
 */
export function columnOf(reading: number) {
  const level = meniscusOf(reading);
  return [
    [0, BURETTE.stopcock],
    [BURETTE.bore, BURETTE.stopcock],
    ...Arr.makeBy(MENISCUS.steps + 1, (step) => {
      const share = step / MENISCUS.steps;
      return [
        BURETTE.bore - share * MENISCUS.reach,
        level + MENISCUS.rise * (1 - share) ** 2,
      ] as const;
    }),
    [0, level],
  ] as const;
}

/**
 * The scale fired on a burette: a mark at every millilitre and a number at
 * every fifth, 0 at the top and 50 at the bottom, as a burette is read.
 * `middle` is the height of the sheet's middle above the tip.
 *
 * @param ink - The colour of the enamel
 * @param format - How a number is written, in the reader's locale
 */
export function scaleOf(
  ink: string,
  format: (value: number, digits: number) => string
) {
  const run = BURETTE.zero - BURETTE.full;
  const left = -SLEEVE.width / 2 + 0.002;
  const sheet: Sheet = {
    height: run + SLEEVE.margin * 2,
    marks: ruleMarks(
      {
        from: [left, run / 2],
        scale: { from: 0, major: 5, minor: 1, to: BURETTE.capacity },
        side: 1,
        to: [left, -run / 2],
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
    width: SLEEVE.width,
  };
  return { middle: (BURETTE.zero + BURETTE.full) / 2, sheet };
}

/**
 * The Schellbach stripe down the back of a burette: a white band with a
 * narrow blue line along its middle, which the meniscus draws into a point
 * that is easy to read.
 *
 * @param white - The colour of the band
 * @param blue - The colour of its centre line
 */
export function stripeOf(white: string, blue: string): Sheet {
  const height = BURETTE.top - BURETTE.full;
  const width = BURETTE.radius * 1.5;
  return {
    ground: white,
    height,
    marks: [
      {
        at: [0, 0],
        height,
        ink: blue,
        kind: "band",
        radius: 0,
        width: width * 0.2,
      },
    ],
    width,
  };
}
