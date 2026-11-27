import {
  graduate,
  ScaleSchema,
  shareAt,
} from "@repo/design-system/components/three/print/scale";
import type { Mark } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr, Schema } from "effect";

/**
 * A scale laid along a straight line, as on a ruler, the side of a beaker
 * or the barrel of a gas syringe: where each tick and number stands, and
 * where on the line a value is read.
 */

/** A place on the sheet, in metres from its middle. */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/**
 * A straight scale as an author states it: the places on the sheet where
 * its two ends are read, and its scale. Ticks grow to the left of the
 * direction of travel for a `side` of 1 and to its right for -1.
 */
const RuleSchema = Schema.Struct({
  from: PointSchema,
  scale: ScaleSchema,
  side: Schema.Literals([-1, 1]),
  to: PointSchema,
});
type Rule = typeof RuleSchema.Type;

/**
 * How the ticks and numbers of a straight scale are printed: the ink, the
 * length of a numbered tick and of a short one, the width of a stroke, and
 * the height of a number, all in metres. A `size` of 0 prints no numbers.
 * `turn` rotates the numbers, for a scale read from its side, such as a
 * ruler lying across the view.
 */
const StyleSchema = Schema.Struct({
  ink: Schema.String,
  major: Schema.Finite,
  minor: Schema.Finite,
  size: Schema.Finite,
  turn: Schema.optionalKey(Schema.Finite),
  width: Schema.Finite,
});

/** The gap between a tick's end and its number, as a share of the number's height. */
const GAP = 0.45;

/** The place on the sheet where a straight scale reads a value, held inside the scale. */
export function ruleAt(rule: Rule, value: number): readonly [number, number] {
  const share = shareAt(rule.scale, value);
  return [
    rule.from[0] + share * (rule.to[0] - rule.from[0]),
    rule.from[1] + share * (rule.to[1] - rule.from[1]),
  ];
}

/**
 * Where a number stands against its anchor: `reads` is how far the tick's
 * direction runs along the number's line of reading, from -1 to 1. A number
 * read along its tick starts or ends at the anchor, and one read across it
 * is centred on it.
 */
function numberAlign(reads: number) {
  if (Math.abs(reads) < 0.5) {
    return "middle" as const;
  }
  return reads > 0 ? ("start" as const) : ("end" as const);
}

/** The unit direction ticks grow in: square to the scale, on its chosen side. */
function tickDirection(rule: Rule): readonly [number, number] {
  const along = [rule.to[0] - rule.from[0], rule.to[1] - rule.from[1]] as const;
  const length = Math.hypot(along[0], along[1]);
  if (length === 0) {
    return [0, 0];
  }
  return [(-along[1] / length) * rule.side, (along[0] / length) * rule.side];
}

/**
 * The printed ticks and numbers of a straight scale: a stroke square to the
 * scale at every step, longer at the numbered ones, and each number past
 * the end of its tick, set towards the side the ticks grow to.
 *
 * @param rule - The scale and the places its two ends are read at
 * @param format - How a number is written, in the reader's locale
 * @param style - The ink and the sizes of the ticks and numbers
 */
export function ruleMarks(
  rule: Rule,
  format: (value: number, digits: number) => string,
  style: typeof StyleSchema.Type
): readonly Mark[] {
  const [across, up] = tickDirection(rule);
  const turn = style.turn ?? 0;
  const reads = across * Math.cos(turn) + up * Math.sin(turn);
  const align = numberAlign(reads);
  return Arr.flatMap(graduate(rule.scale, format), (tick): readonly Mark[] => {
    const [x, y] = ruleAt(rule, tick.value);
    const length = tick.major ? style.major : style.minor;
    const stroke: Mark = {
      from: [x, y],
      ink: style.ink,
      kind: "line",
      to: [x + across * length, y + up * length],
      width: style.width,
    };
    if (!(tick.major && style.size > 0)) {
      return [stroke];
    }
    const clear = length + style.size * (align === "middle" ? GAP + 0.5 : GAP);
    return [
      stroke,
      {
        align,
        at: [x + across * clear, y + up * clear],
        face: "sans",
        ink: style.ink,
        kind: "text",
        size: style.size,
        text: tick.label,
        turn,
        weight: 700,
      },
    ];
  });
}
