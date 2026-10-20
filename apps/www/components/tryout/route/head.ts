import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The head of one try-out page, with the title, description, canonical link,
 * alternates, social card and JSON-LD of the head seam. The page's own title
 * is its only part, so the head seam names the site once.
 */
export function createTryoutHead(input: {
  readonly canonicalPath: LocalizedPath;
  readonly description: string;
  readonly image: string;
  /** False keeps the page out of search results, as an attempt page is. */
  readonly indexable: boolean;
  readonly jsonLd: readonly Readonly<Record<string, unknown>>[];
  readonly locale: Locale;
  readonly title: string;
}) {
  return toRouterHead(
    createSeoHead({
      canonicalPath: input.canonicalPath,
      description: input.description,
      image: input.image,
      indexable: input.indexable,
      jsonLd: [...input.jsonLd],
      locale: input.locale,
      parts: [input.title],
      type: "website",
    })
  );
}
