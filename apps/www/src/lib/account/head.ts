import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Schema } from "effect";
import {
  createPrivateSeoHead,
  createSeoHead,
  toRouterHead,
} from "@/lib/seo/head";

/** The serializable SEO facts that a signed-in screen's loader returns to its head. */
export const ScreenSeo = Schema.Struct({
  canonicalPath: LocalizedPath,
  description: Schema.String,
  /** The screen's own social image, such as a shared island's snapshot; the site's card without one. */
  image: Schema.optionalKey(Schema.String),
  indexable: Schema.Boolean,
  locale: LocaleSchema,
  title: Schema.String,
});

export type ScreenSeo = typeof ScreenSeo.Type;

/** The router head entries of one signed-in screen, built by the head seam from its facts. */
export function signedInHead(seo: ScreenSeo) {
  return toRouterHead(
    createSeoHead({
      canonicalPath: seo.canonicalPath,
      description: seo.description,
      image: seo.image ?? "/og.png",
      indexable: seo.indexable,
      jsonLd: [],
      locale: seo.locale,
      parts: [seo.title],
      type: "website",
    })
  );
}

/** The robots rule of a search that names a query: kept out of indexes, while its links are followed. */
const QUERY_ROBOTS = "noindex,follow";

/**
 * The head of the search page. The bare page names no query and holds no learner's
 * data, so search engines may index it; a page with a query is a result list,
 * which stays out of indexes while engines still follow its links.
 */
export function searchHead(seo: ScreenSeo, query: string) {
  const head = signedInHead(seo);
  if (query === "") {
    return head;
  }
  return {
    links: head.links,
    meta: Arr.map(head.meta, (entry) =>
      "name" in entry && (entry.name === "robots" || entry.name === "googlebot")
        ? { ...entry, content: QUERY_ROBOTS }
        : entry
    ),
  };
}

/**
 * The head of a profile tab. The reference's profile pages name their canonical
 * address and no hreflang alternates, so the shared head's alternates are left out.
 */
export function profileHead(seo: ScreenSeo) {
  const head = signedInHead(seo);
  return {
    links: Arr.filter(head.links, (link) => link.rel !== "alternate"),
    meta: head.meta,
  };
}

/**
 * The head of a private account screen: its title, description and noindex
 * rules. The reference's settings pages name no canonical address, alternates or
 * social cards, so the head seam builds the private head, which has none of them.
 */
export function privateHead(seo: ScreenSeo) {
  return toRouterHead(
    createPrivateSeoHead({ description: seo.description, parts: [seo.title] })
  );
}
