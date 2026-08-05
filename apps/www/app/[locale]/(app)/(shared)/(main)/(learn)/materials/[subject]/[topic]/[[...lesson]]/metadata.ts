import type { MaterialMetadataContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";

/** Derives one consistent title and description from verified metadata. */
export function toMaterialMetadataCopy(
  source: Pick<MaterialMetadataContent, "metadata">
) {
  const { metadata } = source;

  return {
    description: metadata.description ?? metadata.subject ?? metadata.title,
    title: metadata.title,
  };
}
