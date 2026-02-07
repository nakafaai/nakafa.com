import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { EducationalOrgJsonLd } from "@repo/seo/json-ld/educational-org";
import type { ListItem } from "@repo/seo/types";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Ai } from "@/components/marketing/about/ai";
import { Community } from "@/components/marketing/about/community";
import { Features } from "@/components/marketing/about/features";
import { Hero } from "@/components/marketing/about/hero";
import { Logos } from "@/components/marketing/about/logos";
import { Pricing } from "@/components/marketing/about/pricing";
import { exercisesMenu } from "@/components/sidebar/_data/exercises";
import { subjectMenu } from "@/components/sidebar/_data/subject";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return {
    title: {
      absolute: t("meta-title"),
    },
    description: t("description"),
    alternates: {
      canonical: `/${locale}/about`,
    },
    twitter: {
      card: "summary_large_image",
      title: t("meta-title"),
      description: t("description"),
      images: [
        {
          url: `/open-graph/${locale}-about.png`,
          alt: t("meta-title"),
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    openGraph: {
      title: t("meta-title"),
      description: t("description"),
      url: `https://nakafa.com/${locale}/about`,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [
        {
          url: `/open-graph/${locale}-about.png`,
          alt: t("meta-title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <AboutPageContent locale={locale} />;
}

async function AboutPageContent({ locale }: { locale: Locale }) {
  const [t, tCommon, tSubject, tExercises] = await Promise.all([
    getTranslations({ locale, namespace: "About" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
    getTranslations({ locale, namespace: "Exercises" }),
  ]);

  const breadcrumbItems: ListItem[] = [
    {
      "@type": "ListItem",
      "@id": `https://nakafa.com/${locale}`,
      position: 1,
      name: tCommon("home"),
      item: `https://nakafa.com/${locale}`,
    },
    {
      "@type": "ListItem",
      "@id": `https://nakafa.com/${locale}/about`,
      position: 2,
      name: t("meta-title"),
      item: `https://nakafa.com/${locale}/about`,
    },
  ];

  const collectionItems = [
    ...subjectMenu.flatMap((category) =>
      category.items.map((item) => {
        const name =
          item.title === "grade"
            ? `${tSubject(category.title)} ${tSubject("grade", { grade: item.value })}`
            : `${tSubject(category.title)} ${tSubject(item.title)}`;
        const description = tSubject("grade-description");
        return {
          url: `https://nakafa.com/${locale}${item.href}`,
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
          url: `https://nakafa.com/${locale}${item.href}`,
          name,
          description,
        };
      })
    ),
  ];

  return (
    <>
      <BreadcrumbJsonLd breadcrumbItems={breadcrumbItems} />
      <EducationalOrgJsonLd />
      <CollectionPageJsonLd
        description={t("description")}
        items={collectionItems}
        name={t("meta-title")}
        url={`https://nakafa.com/${locale}/about`}
      />
      <div className="relative grid" data-pagefind-ignore>
        <Hero />
        <Logos />
        <Features />
        <Ai />
        <Pricing />
        <Community />
      </div>
    </>
  );
}
