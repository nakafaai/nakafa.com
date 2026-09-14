import {
  type ContentCacheScope,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "next-intl";
import type { SEOContext, SEOMetadata } from "@/lib/seo/contract";
import { generateSEOMetadata } from "@/lib/seo/generator";

/** Maps one SEO projection to the mutable dependency it reads. */
const seoContentScope = {
  article: "article",
  "curriculum-context": "program",
  "material-lesson": "material",
  quran: "quran",
} as const satisfies Record<SEOContext["type"], ContentCacheScope>;

/** Resolves SEO metadata inside the framework cache boundary. */
export async function getCachedSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  "use cache";

  cacheTag(makeContentCacheTag(seoContentScope[context.type]));
  // SEO metadata keeps the long built-in profile on purpose. The family tag
  // above is what refreshes it, so it does not need the hourly content
  // revalidation the shared profile carries.
  cacheLife("max");

  return await Effect.runPromise(generateSEOMetadata(context, locale));
}
