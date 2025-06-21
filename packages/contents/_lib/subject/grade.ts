import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import {
  type Grade,
  nonNumericGradeSchema,
} from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import type { LucideIcon } from "lucide-react";
import { getCategoryPath } from "./category";

/**
 * Gets the path to the grade of the subject.
 * @param category - The category to get the path for.
 * @param grade - The grade to get the path for.
 * @returns The path to the grade.
 */
export function getGradePath(category: SubjectCategory, grade: Grade) {
  return `/subject/${category}/${grade}` as const;
}

/**
 * Gets the non-numeric grade.
 * @param grade - The grade to get.
 * @returns The non-numeric grade.
 */
export function getGradeNonNumeric(grade: Grade) {
  const parsedGrade = nonNumericGradeSchema.safeParse(grade);

  if (!parsedGrade.success) {
    return undefined;
  }

  return parsedGrade.data;
}

/**
 * Gets the subjects for a grade.
 * @param category - The category to get the subjects for.
 * @param grade - The grade to get the subjects for.
 * @returns The subjects for the grade.
 */
export async function getGradeSubjects(
  category: SubjectCategory,
  grade: Grade
): Promise<
  {
    icon: LucideIcon;
    label: Material;
    href: string;
  }[]
> {
  try {
    const gradePath = getCategoryPath(category);

    const cleanPath = gradePath.startsWith("/")
      ? gradePath.substring(1)
      : gradePath;

    const gradeModule = await import(
      `@repo/contents/${cleanPath}/_data/subject.ts`
    );

    return gradeModule.getSubjects(grade);
  } catch {
    return [];
  }
}
