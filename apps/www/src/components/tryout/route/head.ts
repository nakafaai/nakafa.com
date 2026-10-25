import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { Schema } from "effect";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The title of a try-out page. A plain title takes the site name, and an absolute
 * title is the whole title, as the reference names its retained and preview pages.
 */
const TryoutPageTitleSchema = Schema.Union([
  Schema.String,
  Schema.Struct({ absolute: Schema.String }),
]);

type TryoutPageTitle = typeof TryoutPageTitleSchema.Type;

/** The title facts of a page: a plain title is one part of the site title, and an absolute one stands alone. */
function titleFacts(title: TryoutPageTitle) {
  return typeof title === "string"
    ? { parts: [title] }
    : { absoluteTitle: title.absolute, parts: [] };
}

/**
 * The head of one try-out page, with the title, description, canonical link,
 * alternates, social card and JSON-LD of the head seam.
 */
export function createTryoutHead(input: {
  readonly canonicalPath: LocalizedPath;
  readonly description: string;
  readonly image: string;
  /** False keeps the page out of search results, as an attempt page is. */
  readonly indexable: boolean;
  readonly jsonLd: readonly Readonly<Record<string, unknown>>[];
  readonly locale: Locale;
  readonly title: TryoutPageTitle;
}) {
  return toRouterHead(
    createSeoHead({
      canonicalPath: input.canonicalPath,
      description: input.description,
      image: input.image,
      indexable: input.indexable,
      jsonLd: [...input.jsonLd],
      locale: input.locale,
      ...titleFacts(input.title),
      type: "website",
    })
  );
}
