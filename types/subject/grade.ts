import { z } from "zod";

export const gradeSchema = z.enum([
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
  "bachelor",
  "master",
  "phd",
]);
export type Grade = z.infer<typeof gradeSchema>;
