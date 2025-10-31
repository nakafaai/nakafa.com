import { getCategoryIcon } from "@repo/contents/_lib/subject/category";
import {
  getGradeNonNumeric,
  getGradePath,
  getGradeSubjects,
} from "@repo/contents/_lib/subject/grade";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CardSubject } from "@/components/shared/card-subject";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

type Params = {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, grade } = await params;
  const t = await getTranslations({ locale, namespace: "Subject" });

  const FilePath = getGradePath(category, grade);

  const title = `${t(getGradeNonNumeric(grade) ?? "grade", { grade })} - ${t(category)}`;
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
    description: t("grade-description"),
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

  const [subjects, t] = await Promise.all([
    getGradeSubjects(category, grade),
    getTranslations({ locale, namespace: "Subject" }),
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
        description={t("grade-description")}
        icon={getCategoryIcon(category)}
        title={t(getGradeNonNumeric(grade) ?? "grade", { grade })}
      />
      <LayoutContent>
        <ContainerList>
          {subjects.map((subject) => (
            <CardSubject
              key={subject.label}
              {...subject}
              label={t(subject.label)}
            />
          ))}
        </ContainerList>
      </LayoutContent>
      <FooterContent>
        <RefContent
          githubUrl={getGithubUrl({ path: `/packages/contents${FilePath}` })}
        />
      </FooterContent>
    </>
  );
}
