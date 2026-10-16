import { COMPANY_IDENTITY } from "@repo/seo/company";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import { Array as Arr } from "effect";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
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
import { ProjectileStage } from "@/components/marketing/about/projectile/stage";
import { Schools } from "@/components/marketing/about/schools";
import { HomeToys } from "@/components/marketing/about/toys/intent.client";
import { Tryout } from "@/components/marketing/about/tryout";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import type { MarketingFaqItem } from "@/lib/marketing/faq";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createLocalizedAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const path = `/${locale}`;
  const socialImage = getAppSocialArtwork({
    key: "home",
    locale,
    publicPath: "",
  });

  return {
    title: {
      absolute: t("title"),
    },
    description: t("description"),
    alternates: createLocalizedAlternates(path),
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: socialImage,
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${COMPANY_IDENTITY.url}${path}`,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [
        {
          url: socialImage,
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function Page() {
  const locale = getLocaleOrThrow(await rootLocale());

  return <MarketingHomePageContent locale={locale} />;
}

/**
 * Builds the localized marketing home surface and SEO graph from the same
 * navigation data that powers the app entry points.
 */
async function MarketingHomePageContent({ locale }: { locale: Locale }) {
  const [tMetadata, tSubject, tHome, tPricing, tFaq, featuredTryout] =
    await Promise.all([
      getTranslations({ locale, namespace: "Metadata" }),
      getTranslations({ locale, namespace: "Subject" }),
      getTranslations({ locale, namespace: "Landing" }),
      getTranslations({ locale, namespace: "PricingPage" }),
      getTranslations({ locale, namespace: "Faq" }),
      readFeaturedTryout(locale),
    ]);

  const collectionItems = [
    ...Arr.flatMap(subjectMenu, (category) =>
      Arr.map(category.items, (item) => {
        const name =
          item.title === "grade"
            ? `${tSubject(category.title)} ${tSubject("grade", { grade: item.value })}`
            : `${tSubject(category.title)} ${tSubject(item.title)}`;
        const description = tSubject("grade-description");
        return {
          url: `${COMPANY_IDENTITY.url}/${locale}${getSubjectMenuHref(item, locale)}`,
          name,
          description,
        };
      })
    ),
  ];

  /** The ten questions of the home page. Each one is answered in one place of the dictionaries. */
  const faqItems: MarketingFaqItem[] = [
    { answer: tPricing("a6"), question: tPricing("q6") },
    { answer: tPricing("a20"), question: tPricing("q20") },
    {
      answer: tHome("faq-languages-answer"),
      question: tHome("faq-languages-question"),
    },
    { answer: tHome("faq-nina-answer"), question: tHome("faq-nina-question") },
    { answer: tPricing("a9"), question: tPricing("q9") },
    { answer: tPricing("a12"), question: tPricing("q12") },
    {
      answer: tHome("faq-memory-answer"),
      question: tHome("faq-memory-question"),
    },
    { answer: tHome("faq-data-answer"), question: tHome("faq-data-question") },
    { answer: tFaq("a4"), question: tFaq("q4") },
    { answer: tFaq("a7"), question: tFaq("q7") },
  ];

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
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        }))}
        url={url}
      />
      <div className="relative grid">
        <Hero />
        <Lesson />
        <Tryout value={featuredTryout} />
        <NinaSection />
        <ProjectileStage />
        <Memory />
        <Privacy />
        <Curricula locale={locale} />
        <Letter />
        <Medals />
        <Pricing />
        <Schools />
        <Faq faqs={faqItems} />
        <Community />
        <Closing />
        <HomeToys />
      </div>
    </>
  );
}
