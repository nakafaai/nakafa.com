import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { readMaterialMetadata } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import { parseMaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { readArticleOgMetadata } from "@/app/og/article";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

/** Reads OG copy through the same exclusive owner as each content page. */
export async function readOgMetadata(locale: Locale, slug: string[]) {
  if (slug[0] === "articles") {
    const article = await readArticleOgMetadata(locale, slug);
    if (!article) {
      notFound();
    }
    return article;
  }

  const params = parseMaterialParams(locale, slug);
  if (!params) {
    return await getCachedMetadataFromSlug(locale, slug);
  }

  const source = await readMaterialMetadata(Promise.resolve(params));
  return toMaterialMetadataCopy(source);
}
