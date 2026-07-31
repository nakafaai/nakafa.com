import type { MaterialMetadataSource } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";

/** Derives one consistent title and description from any material owner. */
export function toMaterialMetadataCopy(
  source: Pick<MaterialMetadataSource, "metadata" | "route">
) {
  const { metadata, route } = source;
  const routeTitle = "metadata" in route ? route.metadata.title : route.title;
  const routeDescription =
    "metadata" in route ? route.metadata.description : route.description;

  return {
    description: metadata?.description ?? routeDescription ?? routeTitle,
    title: metadata?.title ?? routeTitle,
  };
}
