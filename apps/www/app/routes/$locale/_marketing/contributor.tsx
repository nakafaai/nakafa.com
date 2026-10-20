import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { createFileRoute } from "@tanstack/react-router";
import { createTranslator, useTranslations } from "use-intl";
import { ContributorGallery } from "@/components/contributor/gallery";
import { HeaderContent } from "@/components/shared/content/header";
import { LayoutContent } from "@/components/shared/content/layout";
import { contributors } from "@/lib/data/contributor";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** The contributors page, which names the people who make the content. */
export const Route = createFileRoute("/$locale/_marketing/contributor")({
  loader: async ({ params }) => {
    const messages = await readRouteMessages({
      data: { locale: params.locale, namespaces: ["Contributor"] },
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Contributor",
    });
    return { description: t("description"), title: t("title") };
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
            parts: [loaderData.title],
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
