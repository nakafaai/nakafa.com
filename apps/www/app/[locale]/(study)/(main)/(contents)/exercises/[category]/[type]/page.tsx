import { getCategoryIcon } from "@repo/contents/_lib/exercises/category";
import {
  getExercisesPath,
  getSubjects,
} from "@repo/contents/_lib/exercises/type";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CardSubject } from "@/components/shared/card-subject";
import { ComingSoon } from "@/components/shared/coming-soon";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Params = {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, type } = await params;
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getExercisesPath(category, type);

  const title = `${t(type)} - ${t(category)}`;
  const path = `/${locale}${FilePath}`;
  const image = {
    url: getOgUrl(locale, FilePath),
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: title,
    },
    description: t("type-description"),
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

export default function Page({ params }: Props) {
  const { locale, category, type } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

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

  const [subjects, t] = await Promise.all([
    getSubjects(category, type),
    getTranslations({ locale, namespace: "Exercises" }),
  ]);

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
        locale={locale}
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
          <ContainerList>
            {subjects.map((subject) => (
              <CardSubject
                href={subject.href}
                icon={getMaterialIcon(subject.label)}
                key={subject.label}
                label={t(subject.label)}
              />
            ))}
          </ContainerList>
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
