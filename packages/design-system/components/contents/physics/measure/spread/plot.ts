import { readingStats } from "@repo/design-system/components/contents/physics/measure/data";
import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type {
  Mark,
  Sheet,
} from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";

/**
 * The results sheet of the spread lab: every student's readings as dots on
 * one row of a shared scale, printed as a real sheet of paper. A dashed teal
 * line stands at the actual value. A tight row is precise, and a row centred
 * on the line is accurate. The chosen student's row is outlined, its dots
 * are amber, and a pink arrow runs from the actual value to the mean of
 * those readings.
 */

/** One student's name and readings, in the order taken. */
const StudentSchema = Schema.Struct({
  name: Schema.String,
  readings: Schema.NonEmptyArray(Schema.Finite),
});

/** The least half-width of the scale, so readings that all agree still get one. */
const LEAST = 0.01;

/** The sheet, in millimetres: its width, the ends of its scale, and the room over, under and for each row. */
const PAGE = {
  foot: 20,
  head: 20,
  left: -50,
  right: 84,
  row: 26,
  width: 190,
} as const;

/** The radius of one dot, the step between two stacked dots, and how far under its row's middle the dots rest. */
const DOT = { radius: 2.6, rest: 6, step: 5.8 } as const;

/** One dash of the line at the actual value, and the gap after it. */
const DASH = { gap: 2, long: 3 } as const;

/** How far the head of the arrow reaches back along it and to either side. */
const HEAD = { back: 3.2, side: 1.9 } as const;

/** The steps a scale may be numbered in, as multiples of a power of ten. */
const STEPS = [1, 2, 5] as const;

/**
 * The numbered step of a scale `span` wide: the smallest of 1, 2, 5 and 10
 * times a power of ten that numbers it four times at most.
 */
function stepOf(span: number) {
  const least = span / 4;
  const power = 10 ** Math.floor(Math.log10(least));
  const multiple = Option.getOrElse(
    Arr.findFirst(STEPS, (step) => step * power >= least),
    () => 10
  );
  return multiple * power;
}

/** A straight stroke from one place to another. */
function stroke(
  from: readonly [number, number],
  to: readonly [number, number],
  ink: string,
  width: number
): Mark {
  return { from, ink, kind: "line", to, width };
}

/**
 * The sheet for the `students` who measured the same `actual` value, with
 * the row of the student at `chosen` picked out.
 *
 * @param students - Each student's name and readings
 * @param actual - The actual value they measured
 * @param chosen - Which student's row is picked out
 * @param label - The actual value as it is printed over its line
 * @param format - How a number is written, in the reader's locale
 */
export function spreadSheet(
  students: readonly (typeof StudentSchema.Type)[],
  actual: number,
  chosen: number,
  label: string,
  format: (value: number, digits: number) => string
): Sheet {
  const height = PAGE.head + students.length * PAGE.row + PAGE.foot;
  const top = height / 2 - PAGE.head;
  const base = top - students.length * PAGE.row;
  const reach =
    Arr.reduce(
      Arr.flatMap(students, (student) => student.readings),
      LEAST,
      (most, reading) => Math.max(most, Math.abs(reading - actual))
    ) * 1.25;
  const major = stepOf(2 * reach);
  const rule = {
    from: [PAGE.left, base],
    scale: {
      from: actual - reach,
      major,
      minor: major / 5,
      to: actual + reach,
    },
    side: -1,
    to: [PAGE.right, base],
  } as const;
  const placeOf = (reading: number) =>
    PAGE.left +
    ((reading - rule.scale.from) / (2 * reach)) * (PAGE.right - PAGE.left);
  const dashes = Math.ceil((top + 4 - base) / (DASH.long + DASH.gap));

  const rows = Arr.flatMap(students, (student, index): readonly Mark[] => {
    const middle = top - (index + 0.5) * PAGE.row;
    const picked = index === chosen;
    const rest = middle - DOT.rest;
    const mean = placeOf(readingStats(student.readings, actual).mean);
    const tip = Math.sign(mean - placeOf(actual));
    const arrow = middle - DOT.rest - 4.2;
    const outline: Mark = {
      at: [0, middle],
      height: PAGE.row - 3,
      ink: PLOT_COLORS.amber,
      kind: "frame",
      line: 0.7,
      radius: 2,
      width: PAGE.width - 10,
    };
    const pick = [
      outline,
      stroke([placeOf(actual), arrow], [mean, arrow], PLOT_COLORS.pink, 0.9),
      stroke(
        [mean, arrow],
        [mean - tip * HEAD.back, arrow + HEAD.side],
        PLOT_COLORS.pink,
        0.9
      ),
      stroke(
        [mean, arrow],
        [mean - tip * HEAD.back, arrow - HEAD.side],
        PLOT_COLORS.pink,
        0.9
      ),
    ];
    return [
      ...(picked ? pick : []),
      words({
        align: "end",
        at: [PAGE.left - 8, middle],
        ink: INSTRUMENT_COLORS.scaleInk,
        size: 7.5,
        text: student.name,
      }),
      stroke(
        [PAGE.left, rest],
        [PAGE.right, rest],
        INSTRUMENT_COLORS.sheetRule,
        0.35
      ),
      ...Arr.map(student.readings, (reading, order): Mark => {
        const below = Arr.filter(
          Arr.take(student.readings, order),
          (earlier) => earlier === reading
        ).length;
        return {
          at: [placeOf(reading), rest + DOT.radius + 0.6 + below * DOT.step],
          height: DOT.radius * 2,
          ink: picked ? PLOT_COLORS.amber : INSTRUMENT_COLORS.scaleInk,
          kind: "band",
          radius: DOT.radius,
          width: DOT.radius * 2,
        };
      }),
    ];
  });

  return {
    ground: INSTRUMENT_COLORS.recordCard,
    height,
    marks: [
      ...rows,
      ...Arr.makeBy(dashes, (dash) => {
        const from = base + dash * (DASH.long + DASH.gap);
        return stroke(
          [placeOf(actual), from],
          [placeOf(actual), Math.min(from + DASH.long, top + 4)],
          PLOT_COLORS.teal,
          0.7
        );
      }),
      words({
        at: [placeOf(actual), top + 10],
        ink: PLOT_COLORS.teal,
        size: 6.5,
        text: label,
      }),
      stroke(
        [PAGE.left, base],
        [PAGE.right, base],
        INSTRUMENT_COLORS.scaleInk,
        0.4
      ),
      ...ruleMarks(rule, format, {
        ink: INSTRUMENT_COLORS.scaleInk,
        major: 4.2,
        minor: 2,
        size: 5.6,
        width: 0.32,
      }),
    ],
    width: PAGE.width,
  };
}
