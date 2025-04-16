import { z } from "zod";

export const SubjectCategory = z.enum([
  "elementary-school",
  "middle-school",
  "high-school",
  "university",
]);
export type SubjectCategory = z.infer<typeof SubjectCategory>;
