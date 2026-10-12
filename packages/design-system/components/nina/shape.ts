import { Schema } from "effect";

/** Names a limb so a test can find it in the drawn picture. */
const LimbSchema = Schema.Literals([
  "armL",
  "armR",
  "leg0",
  "leg1",
  "leg2",
  "leg3",
  "overL",
  "overR",
]);

/** Names the layer of the figure a group draws. */
const PartSchema = Schema.Literals([
  "above",
  "back",
  "face",
  "front",
  "held",
  "legs",
  "upper",
]);

/** How a flat shape is filled and stroked: everything she is drawn with. */
const PaintSchema = Schema.Struct({
  fill: Schema.optionalKey(Schema.String),
  fillOpacity: Schema.optionalKey(Schema.Finite),
  opacity: Schema.optionalKey(Schema.Finite),
  stroke: Schema.optionalKey(Schema.String),
  strokeDasharray: Schema.optionalKey(Schema.String),
  strokeLinecap: Schema.optionalKey(Schema.Literal("round")),
  strokeLinejoin: Schema.optionalKey(Schema.Literal("round")),
  strokeOpacity: Schema.optionalKey(Schema.Finite),
  strokeWidth: Schema.optionalKey(Schema.Finite),
  transform: Schema.optionalKey(Schema.String),
});

const PathProps = Schema.Struct({
  ...PaintSchema.fields,
  d: Schema.String,
  limb: Schema.optionalKey(LimbSchema),
});

const EllipseProps = Schema.Struct({
  ...PaintSchema.fields,
  cx: Schema.Finite,
  cy: Schema.Finite,
  /** Marks an open eye, which blinks. */
  eye: Schema.optionalKey(Schema.Literal(true)),
  rx: Schema.Finite,
  ry: Schema.Finite,
});

const CircleProps = Schema.Struct({
  ...PaintSchema.fields,
  cx: Schema.Finite,
  cy: Schema.Finite,
  r: Schema.Finite,
});

const RectProps = Schema.Struct({
  ...PaintSchema.fields,
  height: Schema.Finite,
  rx: Schema.optionalKey(Schema.Finite),
  width: Schema.Finite,
  x: Schema.optionalKey(Schema.Finite),
  y: Schema.optionalKey(Schema.Finite),
});

const LeafSchema = Schema.Union([
  Schema.TaggedStruct("path", PathProps.fields),
  Schema.TaggedStruct("ellipse", EllipseProps.fields),
  Schema.TaggedStruct("circle", CircleProps.fields),
  Schema.TaggedStruct("rect", RectProps.fields),
]);

const GroupSchema = Schema.TaggedStruct("g", {
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<Shape> => ShapeSchema)
  ),
  part: Schema.optionalKey(PartSchema),
  transform: Schema.optionalKey(Schema.String),
});

type Leaf = typeof LeafSchema.Type;

type GroupFields = typeof GroupSchema.Type;

/** A group of shapes that share a part and a transform. */
interface Group extends GroupFields {}

/** One flat shape of the picture, or a group of them. */
export type Shape = Group | Leaf;

export const ShapeSchema: Schema.Codec<Shape> = Schema.Union([
  LeafSchema,
  GroupSchema,
]);

/** Names a limb so a test can find it in the drawn picture. */
export type LimbName = typeof LimbSchema.Type;

/** Draws a path. */
export function path(props: typeof PathProps.Type) {
  return { _tag: "path", ...props } as const;
}

/** Draws an ellipse. */
export function ellipse(props: typeof EllipseProps.Type) {
  return { _tag: "ellipse", ...props } as const;
}

/** Draws a circle. */
export function circle(props: typeof CircleProps.Type) {
  return { _tag: "circle", ...props } as const;
}

/** Draws a rectangle. */
export function rect(props: typeof RectProps.Type) {
  return { _tag: "rect", ...props } as const;
}

/** Groups shapes under one part or one transform. */
export function group(
  children: readonly Shape[],
  options: { part?: typeof PartSchema.Type; transform?: string }
) {
  return { _tag: "g", children, ...options } as const;
}
