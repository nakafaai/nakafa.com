import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { Ai } from "@/components/marketing/about/ai";
import { Community } from "@/components/marketing/about/community";
import { Faq } from "@/components/marketing/about/faq";
import { Features } from "@/components/marketing/about/features";
import { Hero } from "@/components/marketing/about/hero";
import { Logos } from "@/components/marketing/about/logos";
import { Pricing } from "@/components/marketing/about/pricing";
import { Schools } from "@/components/marketing/about/schools";
import {
  exercisesMenu,
  getExercisesMenuHref,
} from "@/components/sidebar/data/exercises";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const path = `/${locale}`;

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
          url: `/open-graph/${locale}-about.png`,
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
          url: `/open-graph/${locale}-about.png`,
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default function Page(props: PageProps<"/[locale]">) {
  const { locale: rawLocale } = use(props.params);
  const locale = getLocaleOrThrow(rawLocale);

  return <MarketingHomePageContent locale={locale} />;
}

/**
 * Builds the localized marketing home surface and SEO graph from the same
 * navigation data that powers the app entry points.
 */
async function MarketingHomePageContent({ locale }: { locale: Locale }) {
  const [tMetadata, tSubject, tExercises, tFaq] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Subject" }),
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Faq" }),
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
    ...exercisesMenu.flatMap((category) =>
      category.items.map((item) => {
        const name = `${tExercises(item.title)}`;
        const description = tExercises("type-description");
        return {
          url: `https://nakafa.com/${locale}${getExercisesMenuHref(item, locale)}`,
          name,
          description,
        };
      })
    ),
  ];

  const faqItems = [
    { question: tFaq("q1"), answer: tFaq("a1") },
    { question: tFaq("q2"), answer: tFaq("a2") },
    { question: tFaq("q3"), answer: tFaq("a3") },
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
        <Features />
        <Ai />
        <Pricing />
        <Schools />
        <Faq />
        <Community />
      </div>
    </>
  );
}
