import { AllahIcon } from "@hugeicons/core-free-icons";
import { Card } from "@repo/design-system/components/ui/card";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Schema } from "effect";
import { createTranslator } from "use-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { LayoutContent } from "@/components/shared/content/frame";
import { HeaderContent } from "@/components/shared/content/header";
import { QuranSurahRow } from "@/components/shared/quran/surah";
import {
  LEARN_SHELL_CACHE_SCOPES,
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getQuranSurahName } from "@/lib/content/quran/navigation";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { runServerEffect } from "@/lib/server/fn";

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
      cacheTags: readContentCacheTags([...LEARN_SHELL_CACHE_SCOPES, "quran"]),
      description: t("quran-description"),
      image: getAppSocialArtwork({ key: "quran", locale, publicPath: "quran" }),
      locale,
      surahs: Arr.map(surahs, (surah) => ({
        arabic: surah.name.arabic,
        number: surah.number,
        title: getQuranSurahName(surah.name),
      })),
      title,
    };
  });

/** The Quran index: every surah, in order, as one link list. */
export const Route = createFileRoute("/$locale/_main/quran/")({
  loader: ({ params }) => readQuranIndex({ data: { locale: params.locale } }),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { breadcrumbs, description, image, locale, title } = loaderData;
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${locale}/quran`,
        description,
        image,
        indexable: true,
        jsonLd: makeBreadcrumbNodes(breadcrumbs),
        locale,
        parts: [title],
        type: "book",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: QuranIndexPage,
});

function QuranIndexPage() {
  const page = Route.useLoaderData();
  return (
    <>
      <HeaderContent
        description={page.description}
        icon={AllahIcon}
        title={page.title}
      />
      <LayoutContent className="pb-20">
        <Card className="py-0">
          <CardLinks>
            {Arr.map(page.surahs, (surah) => (
              <CardLink
                href={`/quran/${surah.number}`}
                key={surah.number}
                title={surah.title}
              >
                <QuranSurahRow
                  arabic={surah.arabic}
                  number={surah.number}
                  title={surah.title}
                />
              </CardLink>
            ))}
          </CardLinks>
        </Card>
      </LayoutContent>
    </>
  );
}
