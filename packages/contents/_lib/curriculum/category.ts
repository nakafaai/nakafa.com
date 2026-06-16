import { SubjectCategorySchema } from "@repo/contents/_types/curriculum/category";
import type { SubjectCategory } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

/**
 * Builds the public path for a subject category page.
 *
 * @param category - Subject category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: SubjectCategory) {
  return `/curriculum/${category}` as const;
}

/** Narrows one subject category route segment to the supported category union. */
export function parseSubjectCategory(value: string) {
  return Schema.decodeUnknownOption(SubjectCategorySchema)(value);
}
