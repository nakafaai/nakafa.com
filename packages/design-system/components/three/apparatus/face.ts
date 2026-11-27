import {
  dialAngle,
  dialMarks,
} from "@repo/design-system/components/three/print/dial";
import { ScaleSchema } from "@repo/design-system/components/three/print/scale";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Schema } from "effect";

/**
 * What a bench meter shows in its window: the printed card of a moving-coil
 * meter with the angle its needle stands at, or the display of a digital
 * one. The needle reads its angle from the same dial the card is printed
 * from, so the two can never disagree.
 */

/** The window of a bench meter, in metres: what its card or its display fills. */
export const WINDOW = { height: 0.054, width: 0.082 } as const;

/** Where the needle's pivot is on the card, from the card's middle. */
export const PIVOT = [0, -0.02] as const;

/** How far the scale's arc is from the pivot, and how far the needle swings to either side of upright. */
const ARC = { radius: 0.038, swing: 0.85 } as const;

/** The colours a meter's face is printed in: its ground, its ink, and the unit's accent. */
const InkSchema = Schema.Struct({
  accent: Schema.String,
  ground: Schema.String,
  ink: Schema.String,
});

/** A moving-coil meter as an author states it: its scale and the unit it reads in. */
const MovementSchema = Schema.Struct({
  scale: ScaleSchema,
  unit: Schema.String,
});
type Movement = typeof MovementSchema.Type;

/** The dial of a movement: its pivot, its arc and its scale, low end on the left. */
function dialOf(movement: Movement) {
  return {
    centre: PIVOT,
    radius: ARC.radius,
    scale: movement.scale,
    sweep: { from: Math.PI / 2 + ARC.swing, to: Math.PI / 2 - ARC.swing },
  };
}

/**
 * How far the needle of a moving-coil meter leans from upright, in radians,
 * counter-clockwise: at the scale's low end when nothing is read, and held
 * at its ends when the reading is off the scale.
 *
 * @param movement - The meter's scale and unit
 * @param reading - What it reads, or nothing while it reads nothing
 */
export function needleOf(movement: Movement, reading: number | undefined) {
  return (
    dialAngle(dialOf(movement), reading ?? movement.scale.from) - Math.PI / 2
  );
}

/**
 * The printed card of a moving-coil meter: the arc its needle sweeps, a
 * numbered tick at every step, and the unit under the scale.
 *
 * @param movement - The meter's scale and unit
 * @param inks - The card's ground, its ink, and the colour of the unit
 * @param format - How a number is written, in the reader's locale
 */
export function cardOf(
  movement: Movement,
  inks: typeof InkSchema.Type,
  format: (value: number, digits: number) => string
): Sheet {
  const dial = dialOf(movement);
  return {
    ground: inks.ground,
    height: WINDOW.height,
    marks: [
      {
        at: PIVOT,
        from: dial.sweep.from,
        ink: inks.ink,
        kind: "arc",
        radius: ARC.radius + 0.0016,
        to: dial.sweep.to,
        width: 0.0006,
      },
      ...dialMarks(dial, format, { ink: inks.ink, numbered: true }),
      words({
        at: [0, -0.0035],
        ink: inks.accent,
        size: 0.0082,
        text: movement.unit,
      }),
    ],
    width: WINDOW.width,
  };
}

/**
 * The display of a digital meter: its reading in the seven-segment figures
 * of a liquid-crystal display with its unit after it, or a blank display
 * while it reads nothing.
 *
 * @param reading - The figures it shows, already written in the reader's locale, or nothing
 * @param unit - The unit it reads in
 * @param inks - The display's ground and the colour of its lit segments
 */
export function displayOf(
  reading: string | undefined,
  unit: string,
  inks: typeof InkSchema.Type
): Sheet {
  return {
    ground: inks.ground,
    height: WINDOW.height,
    marks:
      reading === undefined
        ? []
        : [
            words({
              align: "end",
              at: [0.018, 0.001],
              face: "mono",
              ink: inks.ink,
              size: 0.022,
              text: reading,
            }),
            words({
              align: "start",
              at: [0.022, -0.006],
              ink: inks.accent,
              size: 0.012,
              text: unit,
            }),
          ],
    width: WINDOW.width,
  };
}

/** The front panel of a power pack, in metres, and the dial its voltage knob turns on. */
export const PANEL = { height: 0.078, width: 0.176 } as const;

/** Where the voltage knob is on the panel, and the radius of the scale about it. */
export const KNOB = { at: [0.044, -0.004], radius: 0.021 } as const;

/** The scale of a school power pack: 0 to 12 V in steps of 2 V, over three quarters of a turn. */
const SUPPLY = {
  centre: KNOB.at,
  radius: KNOB.radius,
  scale: { from: 0, major: 2, to: 12 },
  sweep: { from: Math.PI * 1.25, to: -Math.PI * 0.25 },
};

/**
 * How far the knob of a power pack is turned from pointing straight up, in
 * radians, counter-clockwise, when it is set to a voltage.
 */
export function knobOf(volts: number) {
  return dialAngle(SUPPLY, volts) - Math.PI / 2;
}

/**
 * The printed front panel of a low-voltage power pack: its name, what it
 * supplies, the scale its voltage knob turns on, and the mains switch's
 * legend.
 *
 * @param inks - The panel's ground, its ink, and the colour of its warning legend
 * @param format - How a number is written, in the reader's locale
 */
export function panelOf(
  inks: typeof InkSchema.Type,
  format: (value: number, digits: number) => string
): Sheet {
  return {
    ground: inks.ground,
    height: PANEL.height,
    marks: [
      {
        at: [0, 0],
        height: PANEL.height * 0.92,
        ink: inks.ink,
        kind: "frame",
        line: 0.0005,
        radius: 0.003,
        width: PANEL.width * 0.96,
      },
      ...dialMarks(SUPPLY, format, { ink: inks.ink, numbered: false }),
      words({
        at: [KNOB.at[0], KNOB.at[1] + KNOB.radius + 0.008],
        ink: inks.ink,
        size: 0.0052,
        text: `${format(0, 0)} - ${format(12, 0)} V`,
      }),
      words({
        align: "start",
        at: [-0.078, 0.026],
        ink: inks.ink,
        size: 0.0072,
        text: "DC POWER SUPPLY",
      }),
      words({
        align: "start",
        at: [-0.078, 0.014],
        ink: inks.accent,
        size: 0.0042,
        text: `${format(12, 0)} V  ${format(5, 0)} A MAX`,
        weight: 600,
      }),
      words({
        at: [-0.056, -0.027],
        ink: inks.ink,
        size: 0.0042,
        text: "POWER",
        weight: 600,
      }),
    ],
    width: PANEL.width,
  };
}
