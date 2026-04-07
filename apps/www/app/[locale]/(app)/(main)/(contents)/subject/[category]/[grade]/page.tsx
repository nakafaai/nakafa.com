import { getCategoryIcon } from "@repo/contents/_lib/subject/category";
import {
  getGradeNonNumeric,
  getGradePath,
  getGradeSubjects,
} from "@repo/contents/_lib/subject/grade";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect } from "effect";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem, SubjectList } from "@/components/shared/subject-list";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

interface Params {
  category: SubjectCategory;
  grade: Grade;
  locale: Locale;
}

interface Props {
  params: Promise<Params>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, grade } = await params;
  const t = await getTranslations({ locale, namespace: "Subject" });

  const FilePath = getGradePath(category, grade);

  const title = createSEOTitle([
    t(getGradeNonNumeric(grade) ?? "grade", { grade }),
    t(category),
  ]);
  const path = `/${locale}${FilePath}`;

  let ogUrl: string = getOgUrl(locale, FilePath);

  // Currently only available for grade 9, 10, 11, and 12
  if (
    grade === "9" ||
    grade === "10" ||
    grade === "11" ||
    grade === "12" ||
    grade === "bachelor"
  ) {
    ogUrl = `/open-graph/grade/${locale}-${grade}.png`;
  }

  const image = {
    url: ogUrl,
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: title,
    },
    description: t("grade-description"),
    alternates: {
      canonical: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("grade-description"),
      images: [
        {
          url: ogUrl,
          alt: title,
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    openGraph: {
      title,
      url: path,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade"],
  });
}

export default function Page({ params }: Props) {
  const { locale, category, grade } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <PageContent category={category} grade={grade} locale={locale} />;
}

async function PageContent({
  locale,
  category,
  grade,
}: {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
}) {
  const FilePath = getGradePath(category, grade);

  const { subjects, tCommon, tSubject } = await Effect.runPromise(
    Effect.all(
      {
        subjects: Effect.orElse(
          Effect.tryPromise({
            try: () => getGradeSubjects(category, grade),
            catch: () => new Error("Failed to load subject grades"),
          }),
          () => Effect.succeed([])
        ),
        tCommon: Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Common" }),
          catch: () => new Error("Failed to load Common translations"),
        }),
        tSubject: Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Subject" }),
          catch: () => new Error("Failed to load Subject translations"),
        }),
      },
      {
        concurrency: "unbounded",
      }
    )
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={subjects.map((subject, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${subject.href}`,
          position: index + 1,
          name: tSubject(subject.label),
          item: `https://nakafa.com/${locale}${subject.href}`,
        }))}
      />
      <HeaderContent
        description={tSubject("grade-description")}
        icon={getCategoryIcon(category)}
        link={{
          href: "/subject",
          label: tCommon("explore-grades"),
        }}
        title={tSubject(getGradeNonNumeric(grade) ?? "grade", { grade })}
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
                label={tSubject(subject.label)}
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
