import { Schema } from "effect";

/**
 * What is printed on a lab object, as an author states it: a sheet the real
 * size of the print, in metres, and the marks on it. The origin is the
 * middle of the sheet, x runs to the right and y up, so a mark sits where a
 * ruler laid on the object would find it. Every length is in metres and
 * every angle in radians, counter-clockwise from the x axis.
 */

/** A place on the sheet, in metres from its middle. */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/** The typeface a text is set in: the page's own sans-serif, or its monospace for a display. */
const FaceSchema = Schema.Literals(["mono", "sans"]);

/** Where a text stands against its anchor: its start, its middle, or its end. */
const AlignSchema = Schema.Literals(["end", "middle", "start"]);

/**
 * The box a text must fit: it is set at the largest size from `size` down to
 * `smallest` at which the whole text fits in lines no wider than the box.
 */
const BoxSchema = Schema.Struct({
  height: Schema.Finite,
  leading: Schema.Finite,
  smallest: Schema.Finite,
  width: Schema.Finite,
});

/** A straight stroke, such as the tick of a scale or a rule under a title. */
const LineSchema = Schema.Struct({
  from: PointSchema,
  ink: Schema.String,
  kind: Schema.Literal("line"),
  to: PointSchema,
  width: Schema.Finite,
});

/** A filled rectangle about `at`, such as the hazard stripe of a label. */
const BandSchema = Schema.Struct({
  at: PointSchema,
  height: Schema.Finite,
  ink: Schema.String,
  kind: Schema.Literal("band"),
  radius: Schema.Finite,
  width: Schema.Finite,
});

/** The outline of a rectangle about `at`, such as the border of a plate. */
const FrameSchema = Schema.Struct({
  at: PointSchema,
  height: Schema.Finite,
  ink: Schema.String,
  kind: Schema.Literal("frame"),
  line: Schema.Finite,
  radius: Schema.Finite,
  width: Schema.Finite,
});

/** A stroke along a circle about `at`, from one angle to another. */
const ArcSchema = Schema.Struct({
  at: PointSchema,
  from: Schema.Finite,
  ink: Schema.String,
  kind: Schema.Literal("arc"),
  radius: Schema.Finite,
  to: Schema.Finite,
  width: Schema.Finite,
});

/**
 * A screen of dots over the whole sheet, each `radius` wide and `pitch`
 * apart, every other row shifted by half a pitch, printed at `strength`
 * from 0 to 1: the pebbling of a ball, or a halftone.
 */
const DotsSchema = Schema.Struct({
  ink: Schema.String,
  kind: Schema.Literal("dots"),
  pitch: Schema.Finite,
  radius: Schema.Finite,
  strength: Schema.Finite,
});

/**
 * A text set at `at`: a number of a scale, a formula, a name. Subscript and
 * superscript characters are set as KaTeX sets them (`formula.ts`). `size`
 * is the height of the type's em; the text is centred on `at` from top to
 * bottom, and `turn` rotates it about `at`.
 */
const TextSchema = Schema.Struct({
  align: AlignSchema,
  at: PointSchema,
  box: Schema.optionalKey(BoxSchema),
  face: FaceSchema,
  ink: Schema.String,
  kind: Schema.Literal("text"),
  size: Schema.Finite,
  text: Schema.String,
  turn: Schema.Finite,
  weight: Schema.Finite,
});

/** One printed mark. */
export const MarkSchema = Schema.Union([
  ArcSchema,
  BandSchema,
  DotsSchema,
  FrameSchema,
  LineSchema,
  TextSchema,
]);
export type Mark = typeof MarkSchema.Type;

/**
 * One print: its real size, the marks on it, and its `ground`, the colour of
 * the stock when the print brings its own, such as the paper of a label or
 * the glass of a display. A print without a ground is ink alone, and the
 * part it lies on shows between its marks.
 */
const SheetSchema = Schema.Struct({
  ground: Schema.optionalKey(Schema.String),
  height: Schema.Finite,
  marks: Schema.Array(MarkSchema),
  width: Schema.Finite,
});
export type Sheet = typeof SheetSchema.Type;

/** What an author says of a text; the rest is how most prints set one. */
const WordsSchema = Schema.Struct({
  align: Schema.optionalKey(AlignSchema),
  at: PointSchema,
  box: Schema.optionalKey(BoxSchema),
  face: Schema.optionalKey(FaceSchema),
  ink: Schema.String,
  size: Schema.Finite,
  text: Schema.String,
  turn: Schema.optionalKey(Schema.Finite),
  weight: Schema.optionalKey(Schema.Finite),
});

/**
 * A text mark as most prints set one: the page's sans-serif at a bold
 * weight, centred on its anchor and upright, unless the author says
 * otherwise.
 */
export function words(text: typeof WordsSchema.Type): Mark {
  return {
    align: "middle",
    face: "sans",
    turn: 0,
    weight: 700,
    ...text,
    kind: "text",
  };
}
