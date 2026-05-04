import { getFolderChildNamesSync } from "@repo/contents/_lib/fs";
import { getCategoryPath } from "@repo/contents/_lib/subject/category";
import { getMaterialPath } from "@repo/contents/_lib/subject/route";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import {
  GradeSchema,
  NonNumericGradeSchema,
  NumericGradeSchema,
} from "@repo/contents/_types/subject/grade";
import {
  MaterialBachelorSchema,
  MaterialHighSchoolSchema,
} from "@repo/contents/_types/subject/material";

const orderedGrades = [
  ...NumericGradeSchema.options,
  ...NonNumericGradeSchema.options,
];
const orderedMaterials = [
  ...MaterialHighSchoolSchema.options,
  ...MaterialBachelorSchema.options,
];

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
  const categoryPath = getCategoryPath(category).slice(1);
  const gradeFolders = new Set(
    getFolderChildNamesSync(categoryPath)
      .map(parseGrade)
      .filter((grade) => grade !== null)
  );

  return orderedGrades.filter((grade) => gradeFolders.has(grade));
}

/**
 * Returns the subject list for a single category and grade from content folders.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @returns Subject links backed by material folders, or an empty array when unavailable
 */
export function getGradeSubjects(category: SubjectCategory, grade: Grade) {
  const categoryPath = getCategoryPath(category);
  const gradePath = `${categoryPath.slice(1)}/${grade}`;
  const materialFolders = new Set(getFolderChildNamesSync(gradePath));

  return orderedMaterials
    .filter((material) => materialFolders.has(material))
    .map((material) => ({
      label: material,
      href: getMaterialPath(category, grade, material),
    }));
}

/**
 * Loads grade metadata together with subjects across one or more categories.
 *
 * @param categories - Optional category filter; defaults to every subject category
 * @returns Grade entries with labels, hrefs, and resolved subject lists
 */
export function getAllGradesWithSubjects(
  categories?: readonly SubjectCategory[]
) {
  const categoriesToFetch = categories ?? SubjectCategorySchema.options;

  const gradeEntries = categoriesToFetch.flatMap((category) =>
    getCategoryGrades(category).map((grade) => ({
      category,
      grade,
    }))
  );

  return gradeEntries.map(({ category, grade }) => ({
    category,
    grade,
    label: getGradeNonNumeric(grade) ?? grade,
    href: getGradePath(category, grade),
    subjects: getGradeSubjects(category, grade),
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
