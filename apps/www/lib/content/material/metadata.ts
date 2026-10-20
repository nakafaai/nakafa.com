import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";

/**
 * Derives one consistent page title and description from verified metadata.
 * The search title names the lesson in its learners' search words; the short
 * `title` stays the navigation and heading name.
 */
export function toMaterialMetadataCopy(source: {
  readonly metadata: MaterialLessonProjection["metadata"];
}) {
  const { metadata } = source;

  return {
    description: metadata.description ?? metadata.subject ?? metadata.title,
    title: metadata.searchTitle ?? metadata.title,
  };
}
