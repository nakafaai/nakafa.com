import {
  GradeSchema,
  NonNumericGradeSchema,
} from "@repo/contents/_types/curriculum/grade";
import type { Grade } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

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
