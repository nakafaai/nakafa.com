import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import type { Locale } from "@repo/internationalization/src/locale";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** The serializable SEO facts that a signed-in screen's loader returns to its head. */
export interface ScreenSeo {
  readonly canonicalPath: LocalizedPath;
  readonly description: string;
  readonly indexable: boolean;
  readonly locale: Locale;
  readonly title: string;
}

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
