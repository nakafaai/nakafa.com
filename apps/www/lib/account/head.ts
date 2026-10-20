import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Schema } from "effect";
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
