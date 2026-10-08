import type {
  Props as LineEquationProps,
  LineLabel,
} from "@repo/design-system/components/three/line-equation";
import { LineEndpointsSchema } from "@repo/design-system/lib/geometry/endpoint";
import { Schema } from "effect";

const LinePointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type LinePoint = typeof LinePointSchema.Type;

/** Serializable label contract passed from the server card to WebGL. */
export type ResolvedLineLabel = LineLabel;

/**
 * Serializable line fields passed from the server card to WebGL. Labels are not
 * in this Schema: a Schema cannot describe the React nodes they hold, so
 * `ResolvedLine` takes their type from the WebGL line component instead.
 */
const ResolvedLineFieldsSchema = Schema.Struct({
  color: Schema.optionalKey(Schema.String),
  cone: Schema.optionalKey(
    Schema.Struct({
      position: Schema.Literals(["start", "end", "both"]),
      size: Schema.optionalKey(Schema.Finite),
    })
  ),
  curvePoints: Schema.optionalKey(Schema.Finite),
  /** Membership of exact branch endpoints, independent of sample markers. */
  endpoints: Schema.optionalKey(LineEndpointsSchema),
  lineWidth: Schema.optionalKey(Schema.Finite),
  /** Original authored samples that retain visible point markers. */
  pointIndices: Schema.optionalKey(Schema.Array(Schema.Finite)),
  /** The WebGL line component declares its points as a mutable array. */
  points: Schema.mutable(Schema.Array(LinePointSchema)),
  showPoints: Schema.optionalKey(Schema.Boolean),
  smooth: Schema.optionalKey(Schema.Boolean),
});

/** Serializable line contract passed from the server card to WebGL. */
export type ResolvedLine = typeof ResolvedLineFieldsSchema.Type &
  Pick<LineEquationProps, "labels">;

type CircleLine = Omit<ResolvedLine, "points" | "smooth">;

const CuboidLineSchema = Schema.Struct({
  center: Schema.optionalKey(LinePointSchema),
  height: Schema.Finite,
  kind: Schema.Literal("cuboid"),
  length: Schema.Finite,
  width: Schema.Finite,
});
export type CuboidLine = Pick<
  ResolvedLine,
  "color" | "lineWidth" | "showPoints"
> &
  typeof CuboidLineSchema.Type;

const CircleAngleSchema = Schema.Struct({
  radius: Schema.Finite,
  startDegrees: Schema.Finite,
  sweepDegrees: Schema.Finite,
});

const CircleOutlineLineSchema = Schema.Struct({
  kind: Schema.Literal("circle-outline"),
  radius: Schema.Finite,
});
type CircleOutlineLine = typeof CircleOutlineLineSchema.Type & CircleLine;

const CircleChordLineSchema = Schema.Struct({
  ...CircleAngleSchema.fields,
  kind: Schema.Literal("circle-chord"),
});
type CircleChordLine = typeof CircleChordLineSchema.Type & CircleLine;

const CircleRadiusLineSchema = Schema.Struct({
  degrees: Schema.Finite,
  kind: Schema.Literal("circle-radius"),
  radius: Schema.Finite,
});
type CircleRadiusLine = typeof CircleRadiusLineSchema.Type & CircleLine;

const CircleArcLineSchema = Schema.Struct({
  ...CircleAngleSchema.fields,
  color: Schema.String,
  kind: Schema.Literal("circle-arc"),
  lineWidth: Schema.optionalKey(Schema.Finite),
  segments: Schema.optionalKey(Schema.Finite),
});
type CircleArcFields = typeof CircleArcLineSchema.Type;

/** The label holds React nodes, which no Schema can describe. */
interface CircleArcLine extends CircleArcFields {
  readonly label?: Omit<ResolvedLineLabel, "at"> & { progress?: number };
}

const CircleSegmentLineSchema = Schema.Struct({
  kind: Schema.Literal("circle-segment"),
});
type CircleSegmentLine = Omit<CircleArcLine, "kind"> &
  typeof CircleSegmentLineSchema.Type;

/** Declarative or already-resolved line accepted by the public card. */
export type AuthoredLine =
  | CircleArcLine
  | CircleChordLine
  | CircleOutlineLine
  | CircleRadiusLine
  | CircleSegmentLine
  | CuboidLine
  | ResolvedLine;
