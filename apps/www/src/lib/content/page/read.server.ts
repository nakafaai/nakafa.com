import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { LocalizedPath } from "@repo/internationalization/src/alternates";
import { Effect, Option, Schema } from "effect";
import {
  readPublishedPageCatalog,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import { renderCurrentPublishedPage } from "@/lib/content/page/published";
import type { LegalPageInput } from "@/lib/content/page/read.functions";
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
  const page = yield* renderCurrentPublishedPage({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: path.value,
  });
  if (Option.isNone(page)) {
    return MISSING_LEGAL_PAGE;
  }
  const catalog = yield* readPublishedPageCatalog();
  const counterparts = yield* verifyPublishedPageCatalog(catalog, page.value);
  const { projection } = page.value;
  const canonicalPath: LocalizedPath = `/${locale}/${projection.publicPath}`;
  return {
    _tag: "Legal" as const,
    alternates: createResolvedRouteAlternates(projection, counterparts),
    body: page.value.body,
    canonicalPath,
    description: projection.metadata.description,
    title: projection.metadata.title,
  };
});

/** Reads the head facts of one legal page on the server. */
export const readLegalPageHandler = serverHandler(readLegalPage);
