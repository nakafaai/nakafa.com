import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import type {
  Grade,
  NonNumericGrade,
} from "@repo/contents/_types/subject/grade";
import { NonNumericGradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";
import { getCategoryPath } from "./category";

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

type GradeSubject = z.infer<typeof GradeSubjectSchema>;

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
 * @returns The non-numeric grade, or undefined if the grade is numeric.
 */
export function getGradeNonNumeric(grade: Grade) {
  const parsedGrade = NonNumericGradeSchema.safeParse(grade);

  if (!parsedGrade.success) {
    return;
  }

  return parsedGrade.data;
}

/**
 * Gets the list of grades for a category.
 * @param category - The category to get grades for.
 * @returns An array of grades for the category.
 */
export function getCategoryGrades(category: SubjectCategory) {
  return CATEGORY_GRADES[category] ?? [];
}

/**
 * Gets the subjects for a grade.
 * @param category - The category to get the subjects for.
 * @param grade - The grade to get the subjects for.
 * @returns An array of subjects for the grade.
 */
export async function getGradeSubjects(
  category: SubjectCategory,
  grade: Grade
) {
  try {
    const gradePath = getCategoryPath(category);

    const cleanPath = gradePath.startsWith("/")
      ? gradePath.substring(1)
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

export async function getAllGradesWithSubjects() {
  const allGrades: {
    category: SubjectCategory;
    grade: Grade;
    label: string | NonNumericGrade;
    href: string;
    subjects: GradeSubject;
  }[] = [];

  for (const category of SubjectCategorySchema.options) {
    const grades = CATEGORY_GRADES[category];
    for (const grade of grades) {
      const subjects = await getGradeSubjects(category, grade);
      const nonNumericGrade = getGradeNonNumeric(grade);

      allGrades.push({
        category,
        grade,
        label: nonNumericGrade ?? grade,
        href: getGradePath(category, grade),
        subjects,
      });
    }
  }

  return allGrades;
}
