import type { Locale } from "next-intl";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import type { SEOContext, SEOMetadata } from "@/lib/utils/seo/types";

/** Builds fallback metadata when localized SEO dictionaries are unavailable. */
export function generateFallbackMetadata(
  context: SEOContext,
  locale: Locale
): SEOMetadata {
  const displayName = getDisplayNameFromContext(context);

  if (context.type === "quran") {
    const translation = context.surah.name.translation[locale];

    return {
      title: createSEOTitle([translation, displayName]),
      description: createSEODescription([translation]),
      keywords: [],
    };
  }

  const { data } = context;

  return {
    title: createSEOTitle([data.title, data.subject, displayName]),
    description: createSEODescription([data.description, data.title]),
    keywords: [],
  };
}

/** Reads the best stable source identifier for fallback title construction. */
function getDisplayNameFromContext(context: SEOContext): string {
  if (context.type === "material-lesson") {
    return context.material;
  }
  if (context.type === "article") {
    return context.category;
  }
  if (context.type === "curriculum-context") {
    return context.program ?? context.parent ?? "";
  }
  return "";
}
