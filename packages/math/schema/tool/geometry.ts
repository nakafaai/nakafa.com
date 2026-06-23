import { LearningArtifactDisplayCopy } from "@repo/math/schema/artifact/copy";
import {
  fourPointArraySchema,
  twoPointArraySchema,
  valueInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathGeometryPointsInputSchema = Schema.Struct({
  operation: Schema.Literal(
    "circle",
    "distance",
    "line",
    "midpoint",
    "slope"
  ).annotations({
    description:
      "Choose a point-based coordinate geometry operation. Use exactly two points.",
  }),
  points: twoPointArraySchema.annotations({
    description:
      "Exactly two coordinate points, for example [{ x: '1', y: '2' }, { x: '4', y: '6' }].",
  }),
  display: Schema.optional(LearningArtifactDisplayCopy).annotations({
    description:
      "Student-facing artifact copy in the user's language. Keep it concise, pedagogical, grounded in the requested geometry, and use inline math delimiters such as $$m$$ only when helpful.",
  }),
}).pipe(Schema.mutable);

const MathGeometryIntersectionExpressionsInputSchema = Schema.Struct({
  expressions: Schema.Array(valueInputSchema)
    .pipe(Schema.minItems(2), Schema.mutable)
    .annotations({
      description:
        "At least two equations whose intersections should be found.",
    }),
  display: Schema.optional(LearningArtifactDisplayCopy).annotations({
    description:
      "Student-facing artifact copy in the user's language. Keep it concise, pedagogical, grounded in the requested geometry, and use inline math delimiters only when helpful.",
  }),
  operation: Schema.Literal("intersection").annotations({
    description: "Find intersections from equations.",
  }),
}).pipe(Schema.mutable);

const MathGeometryIntersectionPointsInputSchema = Schema.Struct({
  operation: Schema.Literal("intersection").annotations({
    description: "Find intersections from point-defined lines.",
  }),
  points: fourPointArraySchema.annotations({
    description:
      "Exactly four points defining two lines, where points 1-2 form the first line and points 3-4 form the second.",
  }),
  display: Schema.optional(LearningArtifactDisplayCopy).annotations({
    description:
      "Student-facing artifact copy in the user's language. Keep it concise, pedagogical, grounded in the requested geometry, and use inline math delimiters only when helpful.",
  }),
}).pipe(Schema.mutable);

export const MathGeometryInputSchema = Schema.Union(
  MathGeometryPointsInputSchema,
  MathGeometryIntersectionExpressionsInputSchema,
  MathGeometryIntersectionPointsInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Coordinate geometry tool input. Use points for point-based geometry and expressions for equation intersections.",
  });
