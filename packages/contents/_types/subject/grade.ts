import {
  NON_NUMERIC_GRADES,
  NUMERIC_GRADES,
} from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

const NumericGradeSchema = Schema.Literal(...NUMERIC_GRADES);
export const NonNumericGradeSchema = Schema.Literal(...NON_NUMERIC_GRADES);

export const GradeSchema = Schema.Union(
  NumericGradeSchema,
  NonNumericGradeSchema
);
