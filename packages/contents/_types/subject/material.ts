import { z } from "zod/v4";

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

export const MaterialHighSchoolSchema = z.enum([
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
  "sociology",
]);
export type MaterialHighSchool = z.infer<typeof MaterialHighSchoolSchema>;

export const MaterialBachelorSchema = z.enum([
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations",
]);
export type MaterialBachelor = z.infer<typeof MaterialBachelorSchema>;

export const MaterialSchema = z.union([
  MaterialHighSchoolSchema,
  MaterialBachelorSchema,
]);
export type Material = z.infer<typeof MaterialSchema>;
