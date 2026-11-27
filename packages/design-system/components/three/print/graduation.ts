import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import { ScaleSchema } from "@repo/design-system/components/three/print/scale";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Schema } from "effect";

/**
 * The scale fired on the wall of an upright vessel: a beaker, a measuring
 * cylinder, the barrel of a gas syringe. Each tick stands at the height the
 * vessel holds that much, so the scale is true to the vessel it is on, with
 * its numbers beside the ticks and what it measures written above.
 */

/**
 * A vessel's scale as an author states it: the values it runs between, how
 * far the level rises for each unit, in metres, the height of its numbers,
 * the ink, and the caption above it, such as the unit.
 */
const GraduationSchema = Schema.Struct({
  caption: Schema.String,
  ink: Schema.String,
  rise: Schema.Finite,
  scale: ScaleSchema,
  size: Schema.Finite,
});

/** The lengths of a numbered tick and a short one, the stroke's width, and the margin, in heights of a number. */
const SHAPE = { major: 2.6, margin: 0.8, minor: 1.5, stroke: 0.17 } as const;

/** How wide one figure of a number is, in heights of a number, with room to spare. */
const FIGURE = 0.66;

/** The most figures a number of the scale is given room for. */
const FIGURES = 4;

/**
 * The sheet of a vessel's scale. Its middle is the middle of the scale, so
 * a print mounted at the height the vessel holds the scale's middle value
 * reads true along its whole length.
 *
 * @param graduation - The scale, its rise for each unit, its ink and caption
 * @param format - How a number is written, in the reader's locale
 */
export function graduationSheet(
  graduation: typeof GraduationSchema.Type,
  format: (value: number, digits: number) => string
): Sheet {
  const { caption, ink, rise, scale, size } = graduation;
  const span = Math.abs(scale.to - scale.from) * rise;
  const width =
    size * (SHAPE.major + 0.45 + FIGURE * FIGURES + 2 * SHAPE.margin);
  const left = -width / 2 + size * SHAPE.margin;
  const up = scale.to >= scale.from ? 1 : -1;
  return {
    height: span + size * 5.6,
    marks: [
      ...ruleMarks(
        {
          from: [left, (-span / 2) * up],
          scale,
          side: up === 1 ? -1 : 1,
          to: [left, (span / 2) * up],
        },
        format,
        {
          ink,
          major: size * SHAPE.major,
          minor: size * SHAPE.minor,
          size,
          width: size * SHAPE.stroke,
        }
      ),
      words({
        align: "start",
        at: [left, span / 2 + size * 1.2],
        ink,
        size: size * 0.86,
        text: caption,
      }),
    ],
    width,
  };
}

/**
 * How far the level in an upright round vessel rises for each millilitre,
 * in metres: the height of a millilitre of liquid in a cylinder of the
 * vessel's inner radius.
 */
export function fillRise(radius: number): number {
  return radius > 0 ? 1e-6 / (Math.PI * radius * radius) : 0;
}
