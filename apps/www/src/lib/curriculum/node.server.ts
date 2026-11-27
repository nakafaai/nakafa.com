import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { toCanonicalPath } from "@repo/internationalization/src/rewrite";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import {
  getCurriculumRouteSocialImage,
  resolveCurriculumArtwork,
} from "@/lib/curriculum/artwork";
import { readMaterialCardChapters } from "@/lib/curriculum/chapters";
import { getCurriculumLooks } from "@/lib/curriculum/look";
import {
  readRuntimeCurriculumBreadcrumbs,
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
  readRuntimeCurriculumToc,
  resolveRuntimeCurriculumRoute,
} from "@/lib/curriculum/model";
import type { CurriculumInput } from "@/lib/curriculum/node.functions";
import { readCurriculumSeoContext } from "@/lib/curriculum/seo";
import { readCurriculumTrail } from "@/lib/curriculum/trail";
import { getLocaleOrThrow } from "@/lib/routing/locale/address";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { resolveSEOMetadata } from "@/lib/seo/generator";
import { toHeadAlternates } from "@/lib/seo/head";
import { serverHandler } from "@/lib/server/fn";

/**
 * Reads one curriculum node: its breadcrumbs, its cards or child routes, its
 * outline and its SEO copy. It reads only the release's curriculum, so the build
 * writes its answer for every node it prerenders. An unknown node is answered
 * with 404 by the resolver, which throws before this read returns.
 */
export const readCurriculumPage = Effect.fn("www.curricula.route.read")(
  function* (data: typeof CurriculumInput.Type) {
    const locale = getLocaleOrThrow(data.locale);
    const model = yield* resolveRuntimeCurriculumRoute({
      curriculum: data.curriculum,
      locale,
      path: data.path,
    });
    const { route } = model;
    // The page's topics are what it lists: its material cards, or else its child routes.
    const topics =
      model.materialCards.length > 0
        ? Arr.map(model.materialCards, (card) => card.title)
        : Arr.map(model.childRoutes, (child) => child.title);
    const canonicalPath = Schema.decodeUnknownOption(LocalizedPath)(
      toCanonicalPath(`/${locale}/${route.publicPath}`)
    );
    if (Option.isNone(canonicalPath)) {
      return { kind: "notFound" as const };
    }
    const [catalog, messages, seo] = yield* Effect.all(
      [
        readRuntimeCurriculumCatalog(locale),
        Effect.promise(() => loadLocaleMessages(locale)),
        resolveSEOMetadata(
          readCurriculumSeoContext(route, model.ancestors, topics),
          locale
        ),
      ],
      { concurrency: "unbounded" }
    );
    const trail = yield* readCurriculumTrail(model, catalog);
    const tCommon = createTranslator({
      locale,
      messages,
      namespace: "Common",
    });
    const homeLabel = tCommon("home");
    const subjectLabel = tCommon("subject");
    const childVisuals = getCurriculumLooks(model.childRoutes, (child) =>
      resolveCurriculumArtwork(locale, child)
    );

    return {
      alternates: toHeadAlternates(
        createResolvedRouteAlternates(route, model.alternates)
      ),
      breadcrumbs: createBreadcrumbItems(
        locale,
        readRuntimeCurriculumBreadcrumbs(homeLabel, subjectLabel, model)
      ),
      canonicalPath: canonicalPath.value,
      chapters: readMaterialCardChapters(model.materialCards),
      childCards: Arr.zipWith(
        model.childRoutes,
        childVisuals,
        (route, visual) => ({
          route,
          visual,
        })
      ),
      kind: "found" as const,
      description: seo.description,
      image: getCurriculumRouteSocialImage(locale, route),
      labels: {
        home: homeLabel,
        routeAction: tCommon("view-options"),
        subject: subjectLabel,
      },
      locale,
      materialCards: model.materialCards,
      options: readRuntimeCurriculumOptions(catalog),
      route,
      sourceUrl: model.sourceRevision
        ? getAksaraTreeUrl({
            path: model.sourcePath,
            revision: model.sourceRevision,
          })
        : null,
      title: seo.title,
      toc: readRuntimeCurriculumToc(model, seo.description),
      trail,
    };
  }
);

/** The handler of `readCurriculumRoute`, which runs the read on the server's runtime. */
export const readCurriculumRouteHandler = serverHandler(readCurriculumPage);
