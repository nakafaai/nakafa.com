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

  // The tag does not refresh this entry; Next.js adds it to the page that uses
  // the entry, so the scope still expires that page.
  cacheTag(makeContentCacheTag(seoContentScope[context.type]));
  // SEO metadata keeps the long built-in profile on purpose. Its key holds
  // everything the output is built from, the context and the locale, and the
  // translations change only with a deploy, which starts every cache empty. So
  // nothing the entry returns can go stale, and it needs no hourly
  // revalidation. See `lib/content/profile.ts`.
  cacheLife("max");

  return await Effect.runPromise(generateSEOMetadata(context, locale));
}
