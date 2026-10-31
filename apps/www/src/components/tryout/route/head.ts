import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { Schema } from "effect";
import {
  createSeoHead,
  type HeadAlternate,
  toRouterHead,
} from "@/lib/seo/head";

/**
 * The title of a try-out page. A plain title takes the site name, parts run from the
 * most to the least telling and the title budget drops the last that do not fit, and
 * an absolute title is the whole title, as the reference names its retained and
 * preview pages.
 */
const TryoutPageTitleSchema = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String),
  Schema.Struct({ absolute: Schema.String }),
]);

type TryoutPageTitle = typeof TryoutPageTitleSchema.Type;

/** The title facts of a page: a plain title is one part of the site title, and an absolute one stands alone. */
function titleFacts(title: TryoutPageTitle) {
  if (typeof title === "string") {
    return { parts: [title] };
  }
  return "absolute" in title
    ? { absoluteTitle: title.absolute, parts: [] }
    : { parts: title };
}

/**
 * The head of one try-out page, with the title, description, canonical link,
 * alternates, social card and JSON-LD of the head seam. A catalog page passes the
 * language links the catalog resolved for it (`readTryoutRouteHead`), because its
 * slug can differ by locale; the hub, whose address the route map spells, passes none.
 */
export function createTryoutHead(input: {
  readonly alternates?: readonly (typeof HeadAlternate.Type)[] | undefined;
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
      ...(input.alternates === undefined
        ? {}
        : { alternates: [...input.alternates] }),
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
