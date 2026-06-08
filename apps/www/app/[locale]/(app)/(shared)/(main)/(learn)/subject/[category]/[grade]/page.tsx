import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import {
  getGradeNonNumeric,
  getGradePath,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import { getCategoryIcon } from "@repo/contents/_lib/subject/icons";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { Grade, SubjectCategory } from "@repo/contents/_types/taxonomy";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
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
import { getRuntimeGradeSubjects } from "@/lib/content/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/subject/[category]/[grade]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);

  if (Option.isNone(category) || Option.isNone(grade)) {
    notFound();
  }

  return { category: category.value, grade: grade.value, locale };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/subject/[category]/[grade]">["params"];
}): Promise<Metadata> {
  const { locale, category, grade } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Subject" });

  const FilePath = getGradePath(category, grade);
  const gradeLabel = t(
    Option.getOrElse(getGradeNonNumeric(grade), () => "grade"),
    {
      grade,
    }
  );

  const title = createSEOTitle([gradeLabel, t(category)]);
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

  const description = t("grade-description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: ogUrl,
  });

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade"],
  });
}

/** Reads grade subjects inside a Next Cache Components boundary. */
async function getCachedGradeSubjects(
  category: SubjectCategory,
  grade: Grade,
  locale: Locale
) {
  "use cache";
  cacheLife("seconds");

  return Effect.runPromise(getRuntimeGradeSubjects(category, grade, locale));
}

export default function Page(
  props: PageProps<"/[locale]/subject/[category]/[grade]">
) {
  const { params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);

  if (Option.isNone(category) || Option.isNone(grade)) {
    notFound();
  }

  return (
    <PageContent
      category={category.value}
      grade={grade.value}
      locale={locale}
    />
  );
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

  const [subjects, tCommon, tSubject] = await Promise.all([
    getCachedGradeSubjects(category, grade, locale),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
  ]);
  const gradeLabel = tSubject(
    Option.getOrElse(getGradeNonNumeric(grade), () => "grade"),
    { grade }
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("subject"), path: "/subject" },
          {
            name: gradeLabel,
            path: FilePath,
          },
        ])}
      />
      <HeaderContent
        description={tSubject("grade-description")}
        icon={getCategoryIcon(category)}
        link={{
          href: "/subject",
          label: tCommon("explore-grades"),
        }}
        title={gradeLabel}
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
