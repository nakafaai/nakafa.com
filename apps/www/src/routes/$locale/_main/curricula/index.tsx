import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeCollectionPageNode,
} from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import { CurriculumCardGrid } from "@/components/curriculum/cards";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { ComingSoon } from "@/components/shared/upcoming";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import {
  getCurriculumIndexSocialImage,
  resolveCurriculumCatalogArtwork,
} from "@/lib/curriculum/artwork";
import { getCurriculumLooks } from "@/lib/curriculum/look";
import { readRuntimeCurriculumCatalog } from "@/lib/curriculum/model";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { HOME_TARGET } from "@/lib/routing/target";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { runServerEffect } from "@/lib/server/fn";
import { readStaticData } from "@/lib/static/data";

/**
 * Reads the curriculum chooser of one locale on the server: its cards with their
 * visuals, its source link and the words of its page and head.
 */
const readCurriculumIndex = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ locale: Schema.String }))
  )
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const [catalog, messages] = await runServerEffect(
      Effect.all(
        [
          readRuntimeCurriculumCatalog(locale),
          Effect.promise(() => loadLocaleMessages(locale)),
        ],
        { concurrency: "unbounded" }
      )
    );
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const tLearningPrograms = createTranslator({
      locale,
      messages,
      namespace: "LearningPrograms",
    });
    const title = tLearningPrograms("curriculum-index-title");
    const indexHref = getCurriculumIndexHref(locale);
    const routes = Arr.map(catalog.entries, ({ route }) => route);
    const visuals = getCurriculumLooks(routes, (route) =>
      resolveCurriculumCatalogArtwork(locale, {
        kind: "program",
        programKey: route.programKey,
      })
    );

    return {
      actionLabel: tLearningPrograms("curriculum-index-action"),
      breadcrumbs: createBreadcrumbItems(locale, [
        { name: tCommon("home"), path: "" },
        { name: title, path: indexHref },
      ]),
      cards: Arr.zipWith(routes, visuals, (route, visual) => ({
        route,
        visual,
      })),
      description: tLearningPrograms("curriculum-index-metadata-description"),
      image: getCurriculumIndexSocialImage(locale, indexHref),
      labels: { home: tCommon("home") },
      locale,
      metadataTitle: tLearningPrograms("curriculum-index-metadata-title"),
      sourceUrl: catalog.sourceRevision
        ? getAksaraTreeUrl({
            path: "packages/corpus/curriculum",
            revision: catalog.sourceRevision,
          })
        : null,
      title,
    };
  });

/** The curriculum chooser: every track as a card, with its collection data. */
export const Route = createFileRoute("/$locale/_main/curricula/")({
  loader: ({ params }) =>
    readStaticData(readCurriculumIndex, { locale: params.locale }),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const {
      breadcrumbs,
      cards,
      description,
      image,
      locale,
      metadataTitle,
      title,
    } = loaderData;
    const indexHref = getCurriculumIndexHref(locale);
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${locale}/curricula`,
        description,
        image,
        indexable: true,
        jsonLd: [
          ...makeBreadcrumbNodes(breadcrumbs),
          makeCollectionPageNode({
            description,
            items: Arr.map(cards, ({ route }) => ({
              name: route.title,
              url: `${COMPANY_IDENTITY.url}/${locale}/${route.publicPath}`,
            })),
            name: title,
            url: `${COMPANY_IDENTITY.url}/${locale}${indexHref}`,
          }),
        ],
        locale,
        absoluteTitle: metadataTitle,
        parts: [],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: CurriculumIndexPage,
});

function CurriculumIndexPage() {
  const page = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            home: HOME_TARGET,
            homeLabel: page.labels.home,
            items: [{ label: page.title }],
            title: page.title,
          }}
        />
        <LayoutContent>
          {page.cards.length > 0 ? (
            <CurriculumCardGrid
              actionLabel={page.actionLabel}
              cards={page.cards}
            />
          ) : (
            <ComingSoon />
          )}
        </LayoutContent>
        {page.sourceUrl ? (
          <FooterContent>
            <RefContent githubUrl={page.sourceUrl} />
          </FooterContent>
        ) : null}
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
