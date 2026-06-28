import { formatContentDateISO } from "@repo/contents/_shared/date";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ExerciseAttempt } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/attempt";
import {
  getPracticeQuestionPagination,
  type PracticeRouteData,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ExerciseEntry } from "@/components/exercise/entry";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { getOgUrl } from "@/lib/utils/metadata";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type SinglePracticeData = Extract<PracticeRouteData, { kind: "single" }>;

/** Renders one restored practice question page under the canonical URL. */
export async function SinglePracticePage({
  data,
  locale,
}: {
  data: SinglePracticeData;
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const exerciseLabel = t("number-count", { count: data.exercise.number });
  const exerciseId = slugify(exerciseLabel);
  const description = `${t("exercises")} - ${data.exercise.question.metadata.title} - ${data.setRoute.title}`;
  const educationalLevel = `${t(data.group.sourceType)} - ${t(data.group.sourceMaterial)}`;
  const publishedAt = Option.getOrElse(
    formatContentDateISO(data.exercise.question.metadata.date),
    () => data.exercise.question.metadata.date
  );
  const pagination = getPracticeQuestionPagination({
    publicSetPath: `/${locale}/${data.setRoute.publicPath}`,
    questionNumber: data.exercise.number,
    titleFormatter: (number) => t("number-count", { count: number }),
    totalExercises: data.exerciseCount,
  });

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(data.group.sourceType), path: data.group.pagePath },
          { name: t(data.group.sourceMaterial), path: data.group.materialPath },
          { name: data.group.material.title, path: data.group.material.href },
          {
            name: data.setRoute.title,
            path: `/${locale}/${data.setRoute.publicPath}`,
          },
          {
            name: data.exercise.question.metadata.title,
            path: data.exerciseFilePath,
          },
        ])}
      />
      <LearningResourceJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        educationalLevel={educationalLevel}
        name={data.exercise.question.metadata.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        headline={data.exercise.question.metadata.title}
        image={getOgUrl(locale, data.route.publicPath)}
        url={data.exerciseFilePath}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            link={{
              href: `/${locale}/${data.setRoute.publicPath}`,
              label: data.setRoute.title,
            }}
            title={data.exercise.question.metadata.title}
          />
          <LayoutContent>
            <ExerciseAttempt totalExercises={data.exerciseCount} />
            <ExerciseEntry
              exercise={data.exercise}
              locale={locale}
              setPath={data.setPath}
              srLabel={exerciseLabel}
            />
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>
            <DeferredComments slug={data.exerciseFilePath} />
          </FooterContent>
          <DeferredAiSheetOpen
            contextTitle={data.exercise.question.metadata.title}
          />
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: [
              {
                label: exerciseLabel,
                href: `#${exerciseId}`,
                children: [],
              },
            ],
          }}
          header={{
            title: data.exercise.question.metadata.title,
            href: data.exerciseFilePath,
            description: data.setRoute.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
