import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Schema } from "effect";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** The serializable SEO facts that a signed-in screen's loader returns to its head. */
export const ScreenSeo = Schema.Struct({
  canonicalPath: LocalizedPath,
  description: Schema.String,
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
      image: "/og.png",
      indexable: seo.indexable,
      jsonLd: [],
      locale: seo.locale,
      parts: [seo.title],
      type: "website",
    })
  );
}

type HeadMeta = ReturnType<typeof signedInHead>["meta"][number];

/** Whether a router meta entry is the title, the description or the robots rule. */
function isPrivateMeta(entry: HeadMeta) {
  return (
    "title" in entry ||
    ("name" in entry &&
      (entry.name === "description" || entry.name === "robots"))
  );
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
 * The head of a private account screen: its title, description and noindex rule.
 * The reference's settings pages name no canonical address, alternates or social
 * cards, so only those entries of the shared head are kept.
 */
export function privateHead(seo: ScreenSeo) {
  const head = signedInHead({ ...seo, indexable: false });
  return {
    links: [],
    meta: Arr.filter(head.meta, isPrivateMeta),
  };
}
