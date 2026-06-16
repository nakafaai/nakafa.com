import { cleanSlug } from "@repo/utilities/helper";

/** Normalizes one public route before graph projection derivation. */
export function normalizeSourceRouteProjection(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

/** Joins clean route segments without assigning product identity semantics. */
export function joinRoute(...segments: readonly string[]) {
  return segments.join("/");
}

/** Returns whether a route segment is a canonical non-negative integer string. */
export function isNumberSegment(segment: string) {
  const value = Number.parseInt(segment, 10);

  return Number.isSafeInteger(value) && String(value) === segment;
}

/** Returns whether an exercise segment names a set projection. */
export function isExerciseSetSegment(segment: string) {
  return segment.startsWith("set-");
}

/** Returns the canonical question number for a material practice question segment. */
export function getExerciseQuestionNumberSegment(segment: string) {
  if (isNumberSegment(segment)) {
    return segment;
  }

  const questionPrefix = "question-";

  if (!segment.startsWith(questionPrefix)) {
    return null;
  }

  const questionNumber = segment.slice(questionPrefix.length);

  return isNumberSegment(questionNumber) ? questionNumber : null;
}

/** Returns the material practice question segment for a one-based exercise number. */
export function getExerciseQuestionSegment(exerciseNumber: number) {
  if (!(Number.isSafeInteger(exerciseNumber) && exerciseNumber > 0)) {
    return null;
  }

  return `question-${exerciseNumber}`;
}
