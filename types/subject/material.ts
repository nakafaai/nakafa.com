import { z } from "zod";

export const MaterialListSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string().optional(),
    href: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        href: z.string(),
      })
    ),
  })
);
export type MaterialList = z.infer<typeof MaterialListSchema>;

export const MaterialGrade10Schema = z.enum([
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
]);
export type MaterialGrade10 = z.infer<typeof MaterialGrade10Schema>;

export const MaterialGradeBachelorSchema = z.enum([
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
]);
export type MaterialGradeBachelor = z.infer<typeof MaterialGradeBachelorSchema>;

export const MaterialGradeSchema = z.union([
  MaterialGrade10Schema,
  MaterialGradeBachelorSchema,
]);
export type MaterialGrade = z.infer<typeof MaterialGradeSchema>;
