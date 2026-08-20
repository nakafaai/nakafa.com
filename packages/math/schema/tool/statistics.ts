import {
  expressionInputSchema,
  nonEmptyStringArraySchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathStatisticsDatasetInputSchema = Schema.Struct({
  operation: Schema.Literals([
    "mean",
    "median",
    "mode",
    "quartiles",
    "standard_deviation",
    "variance",
  ]).annotate({
    description: "Choose the descriptive statistics operation.",
  }),
  values: nonEmptyStringArraySchema.annotate({
    description: "Dataset values as exact strings.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathZScoreInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("z_score").annotate({
    description: "Compute a z-score for one target value in a dataset.",
  }),
  values: nonEmptyStringArraySchema.annotate({
    description: "Dataset values as exact strings.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathStatisticsInputSchema = Schema.Union([
  MathStatisticsDatasetInputSchema,
  MathZScoreInputSchema,
]).annotate({
  description:
    "Statistics tool input. z_score requires both a target expression and dataset values.",
});
