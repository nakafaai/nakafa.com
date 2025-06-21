import { z } from "zod/v4";

export const numericGradeSchema = z.enum([
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
export const nonNumericGradeSchema = z.enum(["bachelor", "master", "phd"]);
export type NumericGrade = z.infer<typeof numericGradeSchema>;
export type NonNumericGrade = z.infer<typeof nonNumericGradeSchema>;

export const gradeSchema = z.union([numericGradeSchema, nonNumericGradeSchema]);
export type Grade = z.infer<typeof gradeSchema>;
