import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Community } from "@/components/marketing/about/community";
import { Curricula } from "@/components/marketing/about/curricula";
import { Faq } from "@/components/marketing/about/faq";
import { Features } from "@/components/marketing/about/features";
import { Hero } from "@/components/marketing/about/hero";
import { Logos } from "@/components/marketing/about/logos";
import { Pricing } from "@/components/marketing/about/pricing";
import { Schools } from "@/components/marketing/about/schools";
import { Trust } from "@/components/marketing/about/trust/section";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { getPublishedTrustLesson } from "@/lib/content/material/trust";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { resolveSocialArtwork } from "@/lib/og/artwork";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const path = `/${locale}`;
  const socialImage = resolveSocialArtwork({
    locale,
    publicPath: "",
    reviewedPath: `/open-graph/${locale}-about.png`,
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
      url: `https://nakafa.com${path}`,
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
  const [tMetadata, tSubject, tFaq, trustLesson] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Subject" }),
    getTranslations({ locale, namespace: "Faq" }),
    getPublishedTrustLesson(locale),
  ]);

  const collectionItems = [
    ...subjectMenu.flatMap((category) =>
      category.items.map((item) => {
        const name =
          item.title === "grade"
            ? `${tSubject(category.title)} ${tSubject("grade", { grade: item.value })}`
            : `${tSubject(category.title)} ${tSubject(item.title)}`;
        const description = tSubject("grade-description");
        return {
          url: `https://nakafa.com/${locale}${getSubjectMenuHref(item, locale)}`,
          name,
          description,
        };
      })
    ),
  ];

  const faqItems = [
    { question: tFaq("q1"), answer: tFaq("a1") },
    { question: tFaq("q2"), answer: tFaq("a2") },
    { question: tFaq("q4"), answer: tFaq("a4") },
    { question: tFaq("q5"), answer: tFaq("a5") },
    { question: tFaq("q6"), answer: tFaq("a6") },
    { question: tFaq("q7"), answer: tFaq("a7") },
  ];

  const url = `https://nakafa.com/${locale}`;

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
        mainEntity={faqItems.map((item) => ({
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
        <Logos />
        <Features locale={locale} />
        <Curricula locale={locale} />
        <Trust
          lessonHref={trustLesson.lessonHref}
          sourceHref={trustLesson.sourceHref}
        />
        <Pricing />
        <Schools />
        <Faq />
        <Community />
      </div>
    </>
  );
}
