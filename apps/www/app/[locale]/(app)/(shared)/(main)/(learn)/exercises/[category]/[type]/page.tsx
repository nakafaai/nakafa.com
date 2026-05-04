import { getCategoryIcon } from "@repo/contents/_lib/exercises/category";
import {
  getExercisesPath,
  parseExercisesCategory,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import { getSubjects } from "@repo/contents/_lib/exercises/type";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem, SubjectList } from "@/components/shared/subject-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/exercises/[category]/[type]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseExercisesCategory(rawCategory);
  const type = parseExercisesType(rawType);

  if (!(category && type)) {
    notFound();
  }

  return { category, locale, type };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/exercises/[category]/[type]">["params"];
}): Promise<Metadata> {
  const { locale, category, type } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getExercisesPath(category, type);

  const title = createSEOTitle([t(type), t(category)]);
  const path = `/${locale}${FilePath}`;

  let ogUrl: string = getOgUrl(locale, FilePath);

  // Currently only available for SNBT type
  if (type === "snbt" || type === "tka") {
    ogUrl = `/open-graph/type/${locale}-${type}.png`;
  }

  const image = {
    url: ogUrl,
    width: 1200,
    height: 630,
  };

  const description = createSEODescription([
    t(type),
    t(category),
    t("type-description"),
    t("practice-exercises"),
  ]);

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      url: path,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [image],
    },
    twitter: {
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type"],
  });
}

export default function Page(
  props: PageProps<"/[locale]/exercises/[category]/[type]">
) {
  const { params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseExercisesCategory(rawCategory);
  const type = parseExercisesType(rawType);

  if (!(category && type)) {
    notFound();
  }

  return <PageContent category={category} locale={locale} type={type} />;
}

async function PageContent({
  locale,
  category,
  type,
}: {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
}) {
  const FilePath = getExercisesPath(category, type);

  const subjects = getSubjects(category, type);
  const t = await getTranslations({ locale, namespace: "Exercises" });

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={subjects.map((subject, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${subject.href}`,
          position: index + 1,
          name: t(subject.label),
          item: `https://nakafa.com/${locale}${subject.href}`,
        }))}
      />
      <HeaderContent
        description={t("type-description")}
        icon={getCategoryIcon(category)}
        title={t(type)}
      />
      <LayoutContent>
        {subjects.length === 0 ? (
          <ComingSoon />
        ) : (
          <SubjectList>
            {subjects.map((subject) => (
              <SubjectItem
                href={subject.href}
                icon={getMaterialIcon(subject.label)}
                key={subject.label}
                label={t(subject.label)}
              />
            ))}
          </SubjectList>
        )}
      </LayoutContent>
      <FooterContent>
        <RefContent
          githubUrl={getGithubUrl({ path: `/packages/contents${FilePath}` })}
        />
      </FooterContent>
    </>
  );
}
