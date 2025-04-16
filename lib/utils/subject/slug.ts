import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { MaterialGrade } from "@/types/subject/material";

/**
 * Gets the path to a subject material based on its category, grade, material, and slug.
 * @param category - The category of the subject.
 * @param grade - The grade of the subject.
 * @param material - The material of the subject.
 * @param slug - The slug of the subject.
 * @returns The path to the subject material.
 */
export function getSlugPath(
  category: SubjectCategory,
  grade: Grade,
  material: MaterialGrade,
  slug: string[]
) {
  return `/subject/${category}/${grade}/${material}/${slug.join("/")}` as const;
}
