import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeCollectionPageNode,
} from "@repo/seo/jsonld/node";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Schema } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { QuranSurahCatalog } from "@/components/shared/quran/catalog";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { toQuranIndexSurahs } from "@/lib/content/quran/navigation";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { getAppSocialArtwork } from "@/lib/og/app";
import { getLocaleOrThrow } from "@/lib/routing/locale/address";
import { HOME_TARGET } from "@/lib/routing/target";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { runServerEffect } from "@/lib/server/fn";
import { readStaticData } from "@/lib/static/data";

/** The surah list of the Quran index, with the words of its page and head. */
const readQuranIndex = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ locale: Schema.String }))
  )
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const [{ surahs }, messages] = await runServerEffect(
      Effect.all(
        [
          readPublishedQuranCatalog(),
          Effect.promise(() => loadLocaleMessages(locale)),
        ],
        { concurrency: "unbounded" }
      )
    );
    const t = createTranslator({ locale, messages, namespace: "Holy" });
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const title = t("quran");

    return {
      breadcrumbs: createBreadcrumbItems(locale, [
        { name: tCommon("home"), path: "" },
        { name: title, path: "/quran" },
      ]),
      description: t("quran-description"),
      image: getAppSocialArtwork({ key: "quran", locale, publicPath: "quran" }),
      locale,
      surahs: toQuranIndexSurahs(surahs, locale),
      title,
    };
  });

/**
 * The Quran index: every surah, in order, as one link list under the page's
 * breadcrumb, which a search in the header narrows in the browser. The
 * description stands in the head and the structured data only.
 */
export const Route = createFileRoute("/$locale/_main/quran/")({
  loader: ({ params }) =>
    readStaticData(readQuranIndex, { locale: params.locale }),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { breadcrumbs, description, image, locale, surahs, title } =
      loaderData;
    const url = `${COMPANY_IDENTITY.url}/${locale}/quran`;
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${locale}/quran`,
        description,
        image,
        indexable: true,
        jsonLd: [
          ...makeBreadcrumbNodes(breadcrumbs),
          makeCollectionPageNode({
            description,
            items: Arr.map(surahs, (surah) => ({
              name: surah.title,
              url: `${url}/${surah.number}`,
            })),
            name: title,
            url,
          }),
        ],
        locale,
        parts: [title],
        type: "book",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: QuranIndexPage,
});

function QuranIndexPage() {
  const page = Route.useLoaderData();
  const t = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  return (
    <TableFiltersProvider>
      <Page width="column">
        <BreadcrumbHeader
          value={{
            action: <TableSearch placeholder={t("search-surah")} />,
            home: HOME_TARGET,
            homeLabel: tCommon("home"),
            items: [{ label: page.title }],
            title: page.title,
          }}
        />
        <PageStack>
          <QuranSurahCatalog surahs={page.surahs} />
        </PageStack>
      </Page>
    </TableFiltersProvider>
  );
}
