import type { Locale } from "next-intl";
import { parseMaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";
import { readArticleOgMetadata } from "@/app/og/article";
import { getMaterialModel } from "@/lib/content/material/publication";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

/** Title and description copy resolved for one social image. */
export interface OgCopy {
  readonly description: string;
  readonly title: string;
}

/** Reads OG copy through the same exclusive owner as each content page.
 *
 * Returns null when no release resolves instead of rendering not-found, so
 * image routes fall back to brand artwork without hosting the shell. */
export async function readOgMetadata(
  locale: Locale,
  slug: string[]
): Promise<OgCopy | null> {
  if (slug[0] === "articles") {
    return await readArticleOgMetadata(locale, slug);
  }

  const params = parseMaterialParams(locale, slug);
  if (!params) {
    const fallback = await getCachedMetadataFromSlug(locale, slug);
    return {
      description: fallback.description ?? fallback.title,
      title: fallback.title,
    };
  }

  const owner = await resolveMaterialOwner(Promise.resolve(params));
  if (!owner) {
    return null;
  }
  if (owner.kind === "preview") {
    return toMaterialMetadataCopy({ metadata: owner.preview.metadata });
  }
  const publication = await getMaterialModel(owner.locale, owner.publicPath);
  if (!publication?.model.projection) {
    return null;
  }
  return toMaterialMetadataCopy({
    metadata: publication.model.projection.metadata,
  });
}
