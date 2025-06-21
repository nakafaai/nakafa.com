import { z } from "zod/v4";

export const SubjectCategorySchema = z.enum([
  "elementary-school",
  "middle-school",
  "high-school",
  "university",
]);
export type SubjectCategory = z.infer<typeof SubjectCategorySchema>;
