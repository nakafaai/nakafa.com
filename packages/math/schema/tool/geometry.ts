import {
  fourPointArraySchema,
  twoPointArraySchema,
  valueInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathGeometryPointsInputSchema = Schema.Struct({
  operation: Schema.Literals([
    "circle",
    "distance",
    "line",
    "midpoint",
    "slope",
  ]).annotate({
    description:
      "Choose a point-based coordinate geometry operation. Use exactly two points.",
  }),
  points: twoPointArraySchema.annotate({
    description:
      "Exactly two coordinate points, for example [{ x: '1', y: '2' }, { x: '4', y: '6' }].",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathGeometryIntersectionExpressionsInputSchema = Schema.Struct({
  expressions: Schema.Array(valueInputSchema)
    .pipe(Schema.mutable, Schema.check(Schema.isMinLength(2)))
    .annotate({
      description:
        "At least two equations whose intersections should be found.",
    }),
  operation: Schema.Literal("intersection").annotate({
    description: "Find intersections from equations.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathGeometryIntersectionPointsInputSchema = Schema.Struct({
  operation: Schema.Literal("intersection").annotate({
    description: "Find intersections from point-defined lines.",
  }),
  points: fourPointArraySchema.annotate({
    description:
      "Exactly four points defining two lines, where points 1-2 form the first line and points 3-4 form the second.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathGeometryInputSchema = Schema.Union([
  MathGeometryPointsInputSchema,
  MathGeometryIntersectionExpressionsInputSchema,
  MathGeometryIntersectionPointsInputSchema,
]).annotate({
  description:
    "Coordinate geometry tool input. Use points for point-based geometry and expressions for equation intersections.",
});
