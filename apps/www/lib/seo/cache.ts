import "@tanstack/react-start/server-only";

import type { Locale } from "@repo/internationalization/src/locale";
import { Effect } from "effect";
import type { SEOContext, SEOMetadata } from "@/lib/seo/contract";
import { generateSEOMetadata } from "@/lib/seo/generator";

/**
 * Resolves the SEO metadata of one page. The metadata is a pure function of the
 * projection that the page already loads and of the locale, so it is derived on
 * each render. The page's CDN scope tag keeps the response fresh, and no store
 * keeps a second copy of the metadata.
 */
export function getCachedSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  return Effect.runPromise(generateSEOMetadata(context, locale));
}
