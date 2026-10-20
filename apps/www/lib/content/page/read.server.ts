import "@tanstack/react-start/server-only";

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import { Effect, Option, Schema } from "effect";
import {
  getPublishedPageCatalog,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import { getCurrentPublishedPage } from "@/lib/content/page/published";
import type { LegalPageInput } from "@/lib/content/page/read.fn";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { serverHandler } from "@/lib/server/fn";

/** The answer for a path that no signed page answers, which the route turns into a 404. */
const MISSING_LEGAL_PAGE = { _tag: "Missing" } as const;

/**
 * The head facts of one reviewed legal page: its title, its description and the
 * alternates of its counterparts in every locale. A path that no signed page
 * answers reads as missing.
 */
const readLegalPage = Effect.fn("www.pages.readLegal")(function* ({
  locale,
  publicPath,
}: LegalPageInput) {
  const path = Schema.decodeOption(PublicPathSchema)(publicPath);
  if (Option.isNone(path)) {
    return MISSING_LEGAL_PAGE;
  }
  const page = yield* Effect.promise(() =>
    getCurrentPublishedPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath: path.value,
    })
  );
  if (!page) {
    return MISSING_LEGAL_PAGE;
  }
  const catalog = yield* Effect.promise(() => getPublishedPageCatalog());
  const counterparts = yield* verifyPublishedPageCatalog(catalog, page);
  const { projection } = page;
  const canonicalPath: LocalizedPath = `/${locale}/${projection.publicPath}`;
  return {
    _tag: "Legal" as const,
    alternates: createResolvedRouteAlternates(projection, counterparts, {
      types: {
        "text/markdown": `/${projection.appLocale}/${projection.publicPath}.md`,
      },
    }),
    canonicalPath,
    description: projection.metadata.description,
    title: projection.metadata.title,
  };
});

/** Reads the head facts of one legal page on the server. */
export const readLegalPageHandler = serverHandler(readLegalPage);
