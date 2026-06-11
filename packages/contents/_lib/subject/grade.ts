import {
  GradeSchema,
  NonNumericGradeSchema,
} from "@repo/contents/_types/subject/grade";
import type { Grade, SubjectCategory } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

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

/** Narrows one subject grade route segment to the supported grade union. */
export function parseGrade(value: string) {
  return Schema.decodeUnknownOption(GradeSchema)(value);
}
