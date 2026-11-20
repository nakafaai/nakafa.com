import type { SEOContext, SEOMetadata } from "@/lib/seo/contract";
import { createSEODescription } from "@/lib/seo/descriptions";
import type { PageKind } from "@/lib/seo/titles";
import { createSEOTitle } from "@/lib/seo/titles";

/** The kind of page each context titles, which decides whether the title names the site. */
const CONTEXT_KIND = {
  article: "article",
  "curriculum-context": "curriculum",
  "material-lesson": "lesson",
  quran: "quran",
} satisfies Record<SEOContext["type"], PageKind>;

/** Builds fallback metadata when localized SEO dictionaries are unavailable. */
export function generateFallbackMetadata(context: SEOContext): SEOMetadata {
  const displayName = getDisplayNameFromContext(context);

  if (context.type === "quran") {
    const translation = context.surah.name.transliteration;

    return {
      title: createSEOTitle([translation, displayName], CONTEXT_KIND.quran),
      description: createSEODescription([translation]),
      keywords: [],
    };
  }

  const { data } = context;

  return {
    title: createSEOTitle(
      [data.title, data.subject, displayName],
      CONTEXT_KIND[context.type]
    ),
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
