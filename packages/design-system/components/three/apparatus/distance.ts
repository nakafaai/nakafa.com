import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import { Array as Arr, Option } from "effect";

/**
 * The scale along a track a block slides on, such as the side of an
 * inclined plane or a rule beside the block: metres from the mark the block
 * starts at, so the place it comes to rest can be read off the track.
 */

/** The steps a scale may be numbered in, largest first. */
const STEPS = [10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

/** How far short of a whole step rounding may leave a length that is one. */
const NEAR = 1e-9;

/** The smallest step a scale is numbered in. */
const FINEST = 0.1;

/**
 * The step a scale that must show `distance` is numbered in: the largest
 * step of 1, 2 or 5 that still puts three numbers before the distance.
 */
export function scaleStep(distance: number) {
  return Option.getOrElse(
    Arr.findFirst(STEPS, (step) => distance / step >= 3),
    () => FINEST
  );
}

/**
 * The scale printed along a track, on a sheet `long` by `tall` that runs
 * the way the block slides: zero where the block starts, `start` from the
 * sheet's near end, a number at every step and four ticks between two
 * numbers.
 *
 * @param plane - The length and height of the sheet, how far from its near end zero stands, and how long one metre is on it
 * @param distance - How far the block slides, in metres
 * @param ink - The colour of the print
 * @param format - How a number is written, in the reader's locale
 */
export function distanceSheet(
  plane: {
    readonly long: number;
    readonly metre: number;
    readonly start: number;
    readonly tall: number;
  },
  distance: number,
  ink: string,
  format: (value: number, digits: number) => string
) {
  const step = scaleStep(distance);
  const most =
    Math.floor((plane.long - plane.start) / plane.metre / step + NEAR) * step;
  const from = plane.start - plane.long / 2;
  return {
    height: plane.tall,
    marks: ruleMarks(
      {
        from: [from, plane.tall / 2],
        scale: { from: 0, major: step, minor: step / 5, to: most },
        side: -1,
        to: [from + most * plane.metre, plane.tall / 2],
      },
      format,
      {
        ink,
        major: plane.tall * 0.34,
        minor: plane.tall * 0.18,
        size: plane.tall * 0.36,
        width: plane.tall * 0.03,
      }
    ),
    width: plane.long,
  };
}

/** How wide the end ticks of a marked span are, and how thick its strokes. */
const SPAN = { stroke: 0.014, tick: 0.12 } as const;

/**
 * A length marked on the bench, on a sheet that lies along it: one stroke
 * `long` with a tick across each end, as a chalk line drawn between the
 * place a block started and the place it stopped.
 *
 * @param long - The marked length
 * @param ink - The colour of the mark
 */
export function spanSheet(long: number, ink: string) {
  const half = long / 2;
  return {
    height: SPAN.tick,
    marks: Arr.map(
      [
        [-half, 0, half, 0],
        [-half, -SPAN.tick / 2, -half, SPAN.tick / 2],
        [half, -SPAN.tick / 2, half, SPAN.tick / 2],
      ] as const,
      ([x, y, toX, toY]) => ({
        from: [x, y] as const,
        ink,
        kind: "line" as const,
        to: [toX, toY] as const,
        width: SPAN.stroke,
      })
    ),
    width: long + SPAN.stroke,
  };
}
