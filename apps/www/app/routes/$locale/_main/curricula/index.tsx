import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Schema } from "effect";
import { createTranslator } from "use-intl";
import { CurriculumCatalogCards } from "@/components/curriculum/cards";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { ComingSoon } from "@/components/shared/upcoming";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getCurriculumIndexSocialImage } from "@/lib/curriculum/artwork";
import { readRuntimeCurriculumCatalog } from "@/lib/curriculum/model";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { makeCollectionPageNode, readBreadcrumbNodes } from "@/lib/seo/json-ld";

/**
 * Reads the curriculum chooser of one locale on the server: its entries, its
 * source link and the words of its page and head.
 */
const readCurriculumIndex = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ locale: Schema.String }))
  )
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const [catalog, messages] = await Promise.all([
      readRuntimeCurriculumCatalog(locale),
      loadLocaleMessages(locale),
    ]);
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const tLearningPrograms = createTranslator({
      locale,
      messages,
      namespace: "LearningPrograms",
    });
    const title = tLearningPrograms("curriculum-index-title");
    const indexHref = getCurriculumIndexHref(locale);

    return {
      actionLabel: tLearningPrograms("curriculum-index-action"),
      breadcrumbs: createBreadcrumbItems(locale, [
        { name: tCommon("home"), path: "" },
        { name: title, path: indexHref },
      ]),
      cacheTags: readContentCacheTags(["program"]),
      description: tLearningPrograms("curriculum-index-metadata-description"),
      entries: catalog.entries,
      image: getCurriculumIndexSocialImage(locale, indexHref),
      labels: { home: tCommon("home"), more: tCommon("more") },
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
    readCurriculumIndex({ data: { locale: params.locale } }),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const {
      breadcrumbs,
      description,
      entries,
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
          ...readBreadcrumbNodes(breadcrumbs),
          makeCollectionPageNode({
            description,
            items: Arr.map(entries, ({ route }) => ({
              name: route.title,
              url: `${COMPANY_IDENTITY.url}/${locale}/${route.publicPath}`,
            })),
            name: title,
            url: `${COMPANY_IDENTITY.url}/${locale}${indexHref}`,
          }),
        ],
        locale,
        parts: [metadataTitle],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: CurriculumIndexPage,
});

function CurriculumIndexPage() {
  const page = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            homeHref: "/home",
            homeLabel: page.labels.home,
            items: [{ label: page.title }],
            menuLabel: page.labels.more,
            title: page.title,
          }}
        />
        <LayoutContent>
          {page.entries.length > 0 ? (
            <CurriculumCatalogCards
              actionLabel={page.actionLabel}
              entries={page.entries}
              locale={page.locale}
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
