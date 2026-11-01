import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeContributorsNode,
} from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr, Record as Rec } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { ContributorGallery } from "@/components/contributor/gallery";
import { LayoutContent } from "@/components/shared/content/frame";
import { HeaderContent } from "@/components/shared/content/header";
import { contributors } from "@/lib/data/contributor";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** The contributors page, which names the people who make the content. */
export const Route = createFileRoute("/$locale/_marketing/contributor")({
  loader: async ({ params }) => {
    const messages = await readStaticData(readRouteMessages, {
      locale: params.locale,
      namespaces: ["Common", "Contributor"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Contributor",
    });
    const tCommon = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Common",
    });
    return {
      description: t("description"),
      home: tCommon("home"),
      name: t("title"),
      title: `${t("title")} - ${COMPANY_IDENTITY.brandName}`,
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createSeoHead({
            canonicalPath: `/${params.locale}/contributor`,
            description: loaderData.description,
            image: getAppSocialArtwork({
              key: "home",
              locale: params.locale,
              publicPath: "",
            }),
            indexable: true,
            jsonLd: [
              ...makeBreadcrumbNodes(
                createBreadcrumbItems(params.locale, [
                  { name: loaderData.home, path: "" },
                  { name: loaderData.name, path: "/contributor" },
                ])
              ),
              makeContributorsNode({
                description: loaderData.description,
                inLanguage: params.locale,
                name: loaderData.name,
                people: Arr.map(contributors, ({ name, social }) => ({
                  name,
                  profiles: Rec.values(social ?? {}),
                })),
                url: `${COMPANY_IDENTITY.url}/${params.locale}/contributor`,
              }),
            ],
            locale: params.locale,
            absoluteTitle: loaderData.title,
            parts: [],
            type: "website",
          })
        ),
  component: ContributorPage,
});

/** The contributors page: its header and the gallery of contributors. */
function ContributorPage() {
  const t = useTranslations("Contributor");
  return (
    <>
      <HeaderContent
        description={t("description")}
        icon={LoveKoreanFingerIcon}
        title={t("title")}
      />
      <LayoutContent className="w-full pb-20">
        <ContributorGallery contributors={contributors} />
      </LayoutContent>
    </>
  );
}
