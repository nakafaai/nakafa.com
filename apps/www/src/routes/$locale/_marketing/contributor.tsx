import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { ContributorGallery } from "@/components/contributor/gallery";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { HeaderContent } from "@/components/shared/content/header";
import { contributors } from "@/lib/data/contributor";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** The contributors page, which names the people who make the content. */
export const Route = createFileRoute("/$locale/_marketing/contributor")({
  loader: async ({ params }) => {
    const messages = await readStaticData(readRouteMessages, {
      locale: params.locale,
      namespaces: ["Contributor"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Contributor",
    });
    return {
      description: t("description"),
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
            jsonLd: [],
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
      <PageFrame width="column">
        <LayoutContent className="w-full pb-20">
          <ContributorGallery contributors={contributors} />
        </LayoutContent>
      </PageFrame>
    </>
  );
}
