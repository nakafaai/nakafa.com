import {
  expressionInputSchema,
  nonEmptyStringArraySchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathStatisticsDatasetInputSchema = Schema.Struct({
  operation: Schema.Literal(
    "mean",
    "median",
    "mode",
    "quartiles",
    "standard_deviation",
    "variance"
  ).annotations({
    description: "Choose the descriptive statistics operation.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Dataset values as exact strings.",
  }),
}).pipe(Schema.mutable);

const MathZScoreInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("z_score").annotations({
    description: "Compute a z-score for one target value in a dataset.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Dataset values as exact strings.",
  }),
}).pipe(Schema.mutable);

export const MathStatisticsInputSchema = Schema.Union(
  MathStatisticsDatasetInputSchema,
  MathZScoreInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Statistics tool input. z_score requires both a target expression and dataset values.",
  });
