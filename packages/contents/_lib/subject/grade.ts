import { getCategoryPath } from "@repo/contents/_lib/subject/category";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import {
  GradeSchema,
  NonNumericGradeSchema,
} from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

const CATEGORY_GRADES: Record<SubjectCategory, Grade[]> = {
  "elementary-school": ["1", "2", "3", "4", "5", "6"],
  "middle-school": ["7", "8", "9"],
  "high-school": ["10", "11", "12"],
  university: ["bachelor"],
};

const GradeSubjectSchema = z.array(
  z.object({
    label: MaterialSchema,
    href: z.string(),
  })
);

/**
 * Builds the public path for a subject grade page.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @returns Canonical grade path
 */
export function getGradePath(category: SubjectCategory, grade: Grade) {
  return `/subject/${category}/${grade}` as const;
}

/**
 * Narrows a grade value to a non-numeric grade when applicable.
 *
 * @param grade - Grade value to inspect
 * @returns Non-numeric grade label, or `undefined` for numeric grades
 */
export function getGradeNonNumeric(grade: Grade) {
  const parsedGrade = NonNumericGradeSchema.safeParse(grade);

  if (!parsedGrade.success) {
    return;
  }

  return parsedGrade.data;
}

/**
 * Returns the supported grades for a subject category.
 *
 * @param category - Subject category slug
 * @returns Ordered list of grades for the category
 */
export function getCategoryGrades(category: SubjectCategory) {
  return CATEGORY_GRADES[category] ?? [];
}

/**
 * Loads the subject list for a single category and grade.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @returns Parsed subject list, or an empty array when unavailable
 */
export async function getGradeSubjects(
  category: SubjectCategory,
  grade: Grade
) {
  try {
    const gradePath = getCategoryPath(category);

    const cleanPath = gradePath.startsWith("/")
      ? gradePath.slice(1)
      : gradePath;

    const gradeModule = await import(
      `@repo/contents/${cleanPath}/_data/subject.ts`
    );

    const result = gradeModule.getSubjects(grade);

    return GradeSubjectSchema.parse(result);
  } catch {
    return [];
  }
}

/**
 * Loads grade metadata together with subjects across one or more categories.
 *
 * @param categories - Optional category filter; defaults to every subject category
 * @returns Grade entries with labels, hrefs, and resolved subject lists
 */
export async function getAllGradesWithSubjects(
  categories?: readonly SubjectCategory[]
) {
  const categoriesToFetch = categories ?? SubjectCategorySchema.options;

  const gradeEntries = categoriesToFetch.flatMap((category) =>
    CATEGORY_GRADES[category].map((grade) => ({
      category,
      grade,
    }))
  );

  const subjectsResults = await Promise.all(
    gradeEntries.map(({ category, grade }) => getGradeSubjects(category, grade))
  );

  return gradeEntries.map(({ category, grade }, index) => ({
    category,
    grade,
    label: getGradeNonNumeric(grade) ?? grade,
    href: getGradePath(category, grade),
    subjects: subjectsResults[index],
  }));
}

/** Narrows one subject grade route segment to the supported grade union. */
export function parseGrade(value: string) {
  const parsedGrade = GradeSchema.safeParse(value);

  if (!parsedGrade.success) {
    return null;
  }

  return parsedGrade.data;
}
