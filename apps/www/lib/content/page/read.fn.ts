import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";
import {
  getPublishedPageCatalog,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import { getCurrentPublishedPage } from "@/lib/content/page/published";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { serverHandler } from "@/lib/server/fn";

/** The locale and the public path of one legal page, as the route receives them. */
export const LegalPageInput = Schema.Struct({
  locale: LocaleSchema,
  publicPath: Schema.String,
});

export type LegalPageInput = typeof LegalPageInput.Type;

/**
 * The head facts of one reviewed legal page: its title, its description and the
 * alternates of its counterparts in every locale. A path that no signed page
 * answers reads as none, so the route answers 404.
 */
const readLegalPage = Effect.fn("www.pages.readLegal")(function* ({
  locale,
  publicPath,
}: LegalPageInput) {
  const path = Schema.decodeOption(PublicPathSchema)(publicPath);
  if (Option.isNone(path)) {
    return null;
  }
  const page = yield* Effect.promise(() =>
    getCurrentPublishedPage({
      appLocale: AppLocaleSchema.make(locale),
      publicPath: path.value,
    })
  );
  if (!page) {
    return null;
  }
  const catalog = yield* Effect.promise(() => getPublishedPageCatalog());
  const counterparts = yield* verifyPublishedPageCatalog(catalog, page);
  const { projection } = page;
  return {
    alternates: createResolvedRouteAlternates(projection, counterparts, {
      types: {
        "text/markdown": `/${projection.appLocale}/${projection.publicPath}.md`,
      },
    }),
    description: projection.metadata.description,
    title: projection.metadata.title,
  };
});

/** Reads the head facts of one legal page on the server. */
export const readLegalPageHandler = serverHandler(readLegalPage);

/** Reads the head facts of one legal page, from the route's loader on the server and in the browser. */
export const readLegalPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LegalPageInput))
  .handler(readLegalPageHandler);
