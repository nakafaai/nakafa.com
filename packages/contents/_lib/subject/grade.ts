import { getFolderChildNames } from "@repo/contents/_lib/fs/cache";
import { getCategoryPath } from "@repo/contents/_lib/subject/category";
import { getMaterialPath } from "@repo/contents/_lib/subject/route";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import { SUBJECT_CATEGORIES } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import {
  GradeSchema,
  NON_NUMERIC_GRADES,
  NonNumericGradeSchema,
  NUMERIC_GRADES,
} from "@repo/contents/_types/subject/grade";
import {
  BACHELOR_MATERIALS,
  HIGH_SCHOOL_MATERIALS,
} from "@repo/contents/_types/subject/material";
import { Effect, Option, Schema } from "effect";

const orderedGrades = [...NUMERIC_GRADES, ...NON_NUMERIC_GRADES];
const orderedMaterials = [...HIGH_SCHOOL_MATERIALS, ...BACHELOR_MATERIALS];

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
 * @returns Non-numeric grade label when applicable
 */
export function getGradeNonNumeric(grade: Grade) {
  return Schema.decodeUnknownOption(NonNumericGradeSchema)(grade);
}

/**
 * Returns the supported grades for a subject category.
 *
 * @param category - Subject category slug
 * @returns Ordered list of grades for the category
 */
export const getCategoryGrades = Effect.fn(
  "contents.subject.getCategoryGrades"
)(function* (category: SubjectCategory) {
  const categoryPath = getCategoryPath(category).slice(1);
  const gradeFolders = new Set(
    (yield* getFolderChildNames(categoryPath).pipe(
      Effect.orElse(() => Effect.succeed([]))
    ))
      .map(parseGrade)
      .filter(Option.isSome)
      .map((grade) => grade.value)
  );

  return orderedGrades.filter((grade) => gradeFolders.has(grade));
});

/**
 * Returns the subject list for a single category and grade from content folders.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @returns Subject links backed by material folders, or an empty array when unavailable
 */
export const getGradeSubjects = Effect.fn("contents.subject.getGradeSubjects")(
  function* (category: SubjectCategory, grade: Grade) {
    const categoryPath = getCategoryPath(category);
    const gradePath = `${categoryPath.slice(1)}/${grade}`;
    const materialFolders = new Set(
      yield* getFolderChildNames(gradePath).pipe(
        Effect.orElse(() => Effect.succeed([]))
      )
    );

    return orderedMaterials
      .filter((material) => materialFolders.has(material))
      .map((material) => ({
        label: material,
        href: getMaterialPath(category, grade, material),
      }));
  }
);

/**
 * Loads grade metadata together with subjects across one or more categories.
 *
 * @param categories - Optional category filter; defaults to every subject category
 * @returns Grade entries with labels, hrefs, and resolved subject lists
 */
export const getAllGradesWithSubjects = Effect.fn(
  "contents.subject.getAllGradesWithSubjects"
)(function* (categories?: readonly SubjectCategory[]) {
  const categoriesToFetch = categories ?? SUBJECT_CATEGORIES;
  const gradeEntryGroups = yield* Effect.all(
    categoriesToFetch.map((category) =>
      getCategoryGrades(category).pipe(
        Effect.map((grades) =>
          grades.map((grade) => ({
            category,
            grade,
          }))
        )
      )
    ),
    { concurrency: "unbounded" }
  );
  const gradeEntries = gradeEntryGroups.flat();

  return yield* Effect.all(
    gradeEntries.map(({ category, grade }) =>
      getGradeSubjects(category, grade).pipe(
        Effect.map((subjects) => ({
          category,
          grade,
          label: Option.getOrElse(getGradeNonNumeric(grade), () => grade),
          href: getGradePath(category, grade),
          subjects,
        }))
      )
    ),
    { concurrency: "unbounded" }
  );
});

/** Narrows one subject grade route segment to the supported grade union. */
export function parseGrade(value: string) {
  return Schema.decodeUnknownOption(GradeSchema)(value);
}
