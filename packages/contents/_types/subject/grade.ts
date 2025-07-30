import * as z from "zod";

export const NumericGradeSchema = z.enum([
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
]);
export const NonNumericGradeSchema = z.enum(["bachelor", "master", "phd"]);
export type NumericGrade = z.infer<typeof NumericGradeSchema>;
export type NonNumericGrade = z.infer<typeof NonNumericGradeSchema>;

export const GradeSchema = z.union([NumericGradeSchema, NonNumericGradeSchema]);
export type Grade = z.infer<typeof GradeSchema>;
