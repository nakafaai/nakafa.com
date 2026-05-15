import { Schema } from "effect";

export const NUMERIC_GRADES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;
export const NON_NUMERIC_GRADES = ["bachelor", "master", "phd"] as const;

export const NumericGradeSchema = Schema.Literal(...NUMERIC_GRADES);
export const NonNumericGradeSchema = Schema.Literal(...NON_NUMERIC_GRADES);
export type NumericGrade = Schema.Schema.Type<typeof NumericGradeSchema>;
export type NonNumericGrade = Schema.Schema.Type<typeof NonNumericGradeSchema>;

export const GradeSchema = Schema.Union(
  NumericGradeSchema,
  NonNumericGradeSchema
);
export type Grade = Schema.Schema.Type<typeof GradeSchema>;
