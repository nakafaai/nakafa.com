import { Quiz03Icon } from "@hugeicons/core-free-icons";
import { getExercisesPagination } from "@repo/contents/_lib/assessment/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { PracticeRouteData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import { getOgUrl } from "@/lib/utils/metadata";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type SetPracticeData = Extract<PracticeRouteData, { kind: "set" }>;

/** Renders one restored practice set page under the canonical URL. */
export async function PracticeSetPage({
  data,
  locale,
}: {
  data: SetPracticeData;
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const pagination = getExercisesPagination(data.pagePath, [
    data.group.material,
  ]);
  const headings: ParsedHeading[] = [
    {
      label: t("exercises"),
      href: "#questions",
      children: [],
    },
  ];
  const description = `${t("exercises")} - ${data.route.title} - ${data.group.material.title}`;
  const educationalLevel = `${t(data.group.sourceType)} - ${t(data.group.sourceMaterial)}`;
  const publishedAt = Option.getOrElse(
    formatContentDateISO(data.exercises[0].question.metadata.date),
    () => data.exercises[0].question.metadata.date
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(data.group.sourceType), path: data.group.pagePath },
          { name: t(data.group.sourceMaterial), path: data.group.materialPath },
          { name: data.group.material.title, path: data.group.material.href },
          { name: data.route.title, path: data.pagePath },
        ])}
      />
      <LearningResourceJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        educationalLevel={educationalLevel}
        name={data.route.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        headline={data.route.title}
        image={getOgUrl(locale, data.route.publicPath)}
        url={data.pagePath}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            link={{
              href: data.group.material.href,
              label: data.group.material.title,
            }}
            title={data.route.title}
          />
          <p className="sr-only">
            {locale === "id"
              ? "Pilih nomor soal untuk membuka latihan lengkap dengan pilihan jawaban dan pembahasan."
              : "Choose a question number to open the full prompt, choices, and explanation."}
          </p>
          <LayoutContent as="section">
            <SubjectList id="questions">
              {data.exercises.map((exercise) => {
                const questionSegment = readPracticeQuestionSegment({
                  locale,
                  number: exercise.number,
                });
                const label = t("number-count", { count: exercise.number });

                return (
                  <SubjectItem
                    href={`${data.pagePath}/${questionSegment}`}
                    icon={Quiz03Icon}
                    key={exercise.number}
                    label={label}
                  />
                );
              })}
            </SubjectList>
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>
            <DeferredComments slug={data.pagePath} />
          </FooterContent>
          <DeferredAiSheetOpen contextTitle={data.route.title} />
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: headings,
          }}
          header={{
            title: data.route.title,
            href: data.pagePath,
            description: data.group.material.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}

/** Builds the localized virtual question segment for one practice set row. */
function readPracticeQuestionSegment({
  locale,
  number,
}: {
  locale: Locale;
  number: number;
}) {
  return locale === "id" ? `soal-${number}` : `question-${number}`;
}
