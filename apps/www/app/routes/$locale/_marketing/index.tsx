import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { createTranslator, useTranslations } from "use-intl";
import { Closing } from "@/components/marketing/about/closing";
import { Community } from "@/components/marketing/about/community";
import { Curricula } from "@/components/marketing/about/curricula";
import { Faq } from "@/components/marketing/about/faq/landing";
import { Hero } from "@/components/marketing/about/hero";
import { Lesson } from "@/components/marketing/about/lesson";
import { Letter } from "@/components/marketing/about/letter";
import { Medals } from "@/components/marketing/about/medals";
import { Memory } from "@/components/marketing/about/memory";
import { NinaSection } from "@/components/marketing/about/nina/section";
import { Pricing } from "@/components/marketing/about/pricing/landing";
import { Privacy } from "@/components/marketing/about/privacy";
import { Schools } from "@/components/marketing/about/schools";
import { CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { HomeToys } from "@/components/marketing/about/toys/intent.client";
import { Tryout } from "@/components/marketing/about/tryout";
import { PageField } from "@/components/marketing/shared/field.client";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import type { MarketingFaqItem } from "@/lib/marketing/faq";
import { readHomeTryout } from "@/lib/marketing/home.fn";
import { getAppSocialArtwork } from "@/lib/og/app";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The marketing home. Its first HTML holds the whole page: the featured try-out
 * is read on the server before the stream, and the head names the locale's
 * title, description and price currency script.
 */
export const Route = createFileRoute("/$locale/_marketing/")({
  loader: async ({ params }) => {
    const [featuredTryout, messages] = await Promise.all([
      readHomeTryout({ data: { locale: params.locale } }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: ["Metadata"] },
      }),
    ]);
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Metadata",
    });
    return {
      description: t("description"),
      featuredTryout,
      title: t("title"),
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : {
          ...toRouterHead(
            createSeoHead({
              canonicalPath: `/${params.locale}`,
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
          scripts: [{ children: pricingCurrencyScript() }],
        },
  component: HomePage,
});

/** The marketing home: the sections of the landing page, with its structured data. */
function HomePage() {
  const { locale } = Route.useParams();
  const { featuredTryout } = Route.useLoaderData();
  const tMetadata = useTranslations("Metadata");
  const tSubject = useTranslations("Subject");
  const tHome = useTranslations("Landing");

  const collectionItems = Arr.flatMap(subjectMenu, (category) =>
    Arr.map(category.items, (item) => {
      const name =
        item.title === "grade"
          ? `${tSubject(category.title)} ${tSubject("grade", { grade: item.value })}`
          : `${tSubject(category.title)} ${tSubject(item.title)}`;
      return {
        description: tSubject("grade-description"),
        name,
        url: `${COMPANY_IDENTITY.url}/${locale}${getSubjectMenuHref(item, locale)}`,
      };
    })
  );

  /**
   * The ten questions of the home page, in the order the page asks them, the
   * first one open. They are the questions no other part of the page answers.
   */
  const faqItems: MarketingFaqItem[] = Arr.map(
    [
      "subjects",
      "account",
      "phone",
      "languages",
      "nina",
      "credits",
      "empty",
      "memory",
      "data",
      "accuracy",
    ] as const,
    (key) => ({
      answer: tHome(`faq-${key}-answer`, { cost: NINA_RESPONSE_CREDITS }),
      question: tHome(`faq-${key}-question`),
    })
  );

  const url = `${COMPANY_IDENTITY.url}/${locale}`;

  return (
    <>
      <CollectionPageJsonLd
        description={tMetadata("description")}
        items={collectionItems}
        name={tMetadata("title")}
        url={url}
      />
      <FAQPageJsonLd
        inLanguage={locale}
        mainEntity={Arr.map(faqItems, (item) => ({
          acceptedAnswer: { "@type": "Answer", text: item.answer },
          name: item.question,
        }))}
        url={url}
      />
      <PageField />
      <div className="relative grid grid-cols-1">
        <Hero />
        <Lesson />
        <Tryout value={featuredTryout} />
        <NinaSection />
        <Memory />
        <Privacy />
        <Curricula locale={locale} />
        <Letter />
        <Medals />
        <Pricing />
        <Schools herd={CLASS_HERD} />
        <Faq faqs={faqItems} />
        <Community />
        <Closing />
        <HomeToys />
      </div>
    </>
  );
}
