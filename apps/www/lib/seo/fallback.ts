import { createSEODescription } from "@/lib/seo/descriptions";
import { createSEOTitle } from "@/lib/seo/titles";
import type { SEOContext, SEOMetadata } from "@/lib/seo/types";

/** Builds fallback metadata when localized SEO dictionaries are unavailable. */
export function generateFallbackMetadata(context: SEOContext): SEOMetadata {
  const displayName = getDisplayNameFromContext(context);

  if (context.type === "quran") {
    const translation = context.surah.name.transliteration;

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
    return context.categoryLabel;
  }
  if (context.type === "curriculum-context") {
    return context.program ?? context.parent ?? "";
  }
  return "";
}
