import { Effect } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import type { SEOContext, SEOMetadata } from "@/lib/seo/contract";
import { generateSEOMetadata } from "@/lib/seo/generator";

/** Resolves SEO metadata inside the framework cache boundary. */
export async function getCachedSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  "use cache";

  cacheLife("max");

  return await Effect.runPromise(generateSEOMetadata(context, locale));
}
