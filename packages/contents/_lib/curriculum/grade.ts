import { type Grade, NON_NUMERIC_GRADES } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

const NonNumericGradeSchema = Schema.Literals(NON_NUMERIC_GRADES);
/**
 * Narrows a grade value to a non-numeric grade when applicable.
 *
 * @param grade - Grade value to inspect
 * @returns Non-numeric grade label when applicable
 */
export function getGradeNonNumeric(grade: Grade) {
  return Schema.decodeUnknownOption(NonNumericGradeSchema)(grade);
}
