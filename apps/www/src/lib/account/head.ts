import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { Array as Arr, Schema } from "effect";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import {
  createPrivateSeoHead,
  createSeoHead,
  toRouterHead,
} from "@/lib/seo/head";

/** The serializable SEO facts that a signed-in screen's loader returns to its head. */
export const ScreenSeo = Schema.Struct({
  canonicalPath: LocalizedPath,
  description: Schema.String,
  indexable: Schema.Boolean,
  locale: LocaleSchema,
  title: Schema.String,
});

export type ScreenSeo = typeof ScreenSeo.Type;

/**
 * The router head entries of one signed-in screen, built by the head seam from its facts. A
 * screen with reviewed artwork, such as Nina's chat, shares it; any other shares the site's image.
 * A screen that search engines index names its place as structured data (`jsonLd`).
 */
export function signedInHead(
  seo: ScreenSeo,
  image = "/og.png",
  jsonLd: readonly Record<string, unknown>[] = []
) {
  return toRouterHead(
    createSeoHead({
      canonicalPath: seo.canonicalPath,
      description: seo.description,
      image,
      indexable: seo.indexable,
      jsonLd,
      kind: "account",
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
 * data, so search engines may index it, and its breadcrumb leads from the locale's
 * home (`home`, that page's name); a page with a query is a result list, which
 * stays out of indexes while engines still follow its links.
 */
export function searchHead(seo: ScreenSeo, query: string, home: string) {
  const head = signedInHead(
    seo,
    undefined,
    makeBreadcrumbNodes(
      createBreadcrumbItems(seo.locale, [
        { name: home, path: "" },
        { name: seo.title, path: "/search" },
      ])
    )
  );
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
