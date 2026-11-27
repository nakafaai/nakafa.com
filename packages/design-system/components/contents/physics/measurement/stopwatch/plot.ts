import { timingSpread } from "@repo/design-system/components/contents/physics/measurement/stopwatch/trials";
import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type {
  Mark,
  Sheet,
} from "@repo/design-system/components/three/print/sheet";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

/**
 * The results sheet of the stopwatch lab: a dot plot of the recorded
 * readings on a scale of seconds, printed as a real sheet of paper. One dot
 * stands for each reading, stacked where readings repeat, with the mean in
 * fuchsia, one standard deviation either side outlined in teal and the
 * uncertainty of the mean outlined in violet.
 */

/** The stretch of time the scale covers, in seconds. */
const SCALE = { from: 17.7, major: 0.1, minor: 0.01, to: 18.2 } as const;

/** The sheet, in millimetres: its size, the ends and height of its scale, and the top of its outlines. */
const PAGE = {
  base: -22,
  height: 96,
  left: -84,
  right: 84,
  top: 38,
  width: 190,
} as const;

/** The radius of one dot, and the step between two stacked dots. */
const DOT = { radius: 2.9, step: 6.3 } as const;

/** Where on the sheet a time stands along the scale, held inside it. */
function placeOf(time: number) {
  const share = (time - SCALE.from) / (SCALE.to - SCALE.from);
  return PAGE.left + Math.min(1, Math.max(0, share)) * (PAGE.right - PAGE.left);
}

/** The outline of the stretch of the scale between two times, in one ink, `tall` high. */
function stretch(from: number, to: number, ink: string, tall: number): Mark {
  const left = placeOf(from);
  const right = placeOf(to);
  return {
    at: [(left + right) / 2, PAGE.base + tall / 2],
    height: tall,
    ink,
    kind: "frame",
    line: 0.7,
    radius: 1.2,
    width: right - left,
  };
}

/**
 * The sheet for the recorded `times`, of which the first `shown` have their
 * dot: the latest reading joins the plot only once its trial is over. The
 * mean and the two outlines are of all the readings.
 *
 * @param times - Every recorded reading, in seconds
 * @param shown - How many of them have their dot
 * @param format - How a number is written, in the reader's locale
 */
export function plotSheet(
  times: readonly number[],
  shown: number,
  format: (value: number, digits: number) => string
): Sheet {
  const { mean, spread, uncertainty } = timingSpread(times);
  const dotted = Arr.take(times, shown);
  const dots = Arr.map(dotted, (time, index): Mark => {
    const below = Arr.filter(
      Arr.take(dotted, index),
      (other) => other === time
    ).length;
    return {
      at: [placeOf(time), PAGE.base + DOT.radius + 0.8 + below * DOT.step],
      height: DOT.radius * 2,
      ink: index === times.length - 1 ? PLOT_COLORS.amber : PLOT_COLORS.orange,
      kind: "band",
      radius: DOT.radius,
      width: DOT.radius * 2,
    };
  });
  return {
    ground: INSTRUMENT_COLORS.recordCard,
    height: PAGE.height,
    marks: [
      stretch(
        mean - spread,
        mean + spread,
        PLOT_COLORS.teal,
        PAGE.top - PAGE.base
      ),
      stretch(
        mean - uncertainty,
        mean + uncertainty,
        PLOT_COLORS.violet,
        PAGE.top - PAGE.base - 5
      ),
      {
        from: [placeOf(mean), PAGE.base],
        ink: PLOT_COLORS.fuchsia,
        kind: "line",
        to: [placeOf(mean), PAGE.top + 3],
        width: 0.9,
      },
      {
        from: [PAGE.left, PAGE.base],
        ink: INSTRUMENT_COLORS.scaleInk,
        kind: "line",
        to: [PAGE.right, PAGE.base],
        width: 0.4,
      },
      ...ruleMarks(
        {
          from: [PAGE.left, PAGE.base],
          scale: SCALE,
          side: -1,
          to: [PAGE.right, PAGE.base],
        },
        format,
        {
          ink: INSTRUMENT_COLORS.scaleInk,
          major: 4.6,
          minor: 2.2,
          size: 6,
          width: 0.32,
        }
      ),
      ...dots,
    ],
    width: PAGE.width,
  };
}
