import { Schema } from "effect";

/**
 * How a flat shape is filled, lined, and placed. Every picture of the identity,
 * an animal, Nina, or one of her things, is drawn with these and nothing else.
 */
const PAINT = {
  fill: Schema.optionalKey(Schema.String),
  fillOpacity: Schema.optionalKey(Schema.Finite),
  fillRule: Schema.optionalKey(Schema.Literal("evenodd")),
  opacity: Schema.optionalKey(Schema.Finite),
  stroke: Schema.optionalKey(Schema.String),
  strokeDasharray: Schema.optionalKey(Schema.String),
  strokeLinecap: Schema.optionalKey(Schema.Literal("round")),
  strokeLinejoin: Schema.optionalKey(Schema.Literal("round")),
  strokeOpacity: Schema.optionalKey(Schema.Finite),
  strokeWidth: Schema.optionalKey(Schema.Finite),
  transform: Schema.optionalKey(Schema.String),
};

const PathFields = Schema.Struct({
  ...PAINT,
  d: Schema.String,
  /** The length the path counts as, so a line that draws itself runs from 1 to 0. */
  pathLength: Schema.optionalKey(Schema.Finite),
});

const EllipseFields = Schema.Struct({
  ...PAINT,
  cx: Schema.Finite,
  cy: Schema.Finite,
  rx: Schema.Finite,
  ry: Schema.Finite,
});

const CircleFields = Schema.Struct({
  ...PAINT,
  cx: Schema.Finite,
  cy: Schema.Finite,
  r: Schema.Finite,
});

const RectFields = Schema.Struct({
  ...PAINT,
  height: Schema.Finite,
  rx: Schema.optionalKey(Schema.Finite),
  width: Schema.Finite,
  x: Schema.optionalKey(Schema.Finite),
  y: Schema.optionalKey(Schema.Finite),
});

const PolygonFields = Schema.Struct({
  ...PAINT,
  points: Schema.String,
});

const GroupFields = Schema.Struct(PAINT);

/**
 * A shape that holds no other shape. Its tag is the name of the SVG element
 * that draws it, so nothing has to translate one into the other.
 */
const LeafSchema = Schema.Union([
  Schema.TaggedStruct("path", PathFields.fields),
  Schema.TaggedStruct("ellipse", EllipseFields.fields),
  Schema.TaggedStruct("circle", CircleFields.fields),
  Schema.TaggedStruct("rect", RectFields.fields),
  Schema.TaggedStruct("polygon", PolygonFields.fields),
]);

type GroupPaint = typeof GroupFields.Type;

/**
 * What a picture says about one of its shapes beyond how it is drawn: the eye
 * of an animal, a limb of Nina, the small motion of a thing. Each kind of
 * picture brings its own marks, and a shape may carry one.
 */
interface Marked<Mark> {
  readonly mark?: Mark;
}

/** Shapes drawn together, under one paint and one transform. */
interface Group<Mark> extends GroupPaint, Marked<Mark> {
  readonly _tag: "g";
  readonly children: readonly Shape<Mark>[];
}

/** One flat shape of a picture, or a group of them. */
export type Shape<Mark = never> =
  | (typeof LeafSchema.Type & Marked<Mark>)
  | Group<Mark>;

/** Draws a path. */
export function path<const Mark = never>(
  fields: typeof PathFields.Type & Marked<Mark>
) {
  return { _tag: "path", ...fields } as const satisfies Shape<Mark>;
}

/** Draws an ellipse. */
export function ellipse<const Mark = never>(
  fields: typeof EllipseFields.Type & Marked<Mark>
) {
  return { _tag: "ellipse", ...fields } as const satisfies Shape<Mark>;
}

/** Draws a polygon from its points, written as SVG writes them. */
export function polygon<const Mark = never>(
  fields: typeof PolygonFields.Type & Marked<Mark>
) {
  return { _tag: "polygon", ...fields } as const satisfies Shape<Mark>;
}

/** Draws shapes together, under one paint and one transform. */
export function group<const Mark = never>(
  children: readonly Shape<Mark>[],
  fields?: GroupPaint & Marked<Mark>
) {
  return { _tag: "g", children, ...fields } as const satisfies Shape<Mark>;
}
