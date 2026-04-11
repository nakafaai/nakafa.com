import { getExerciseNumberPagination } from "@repo/contents/_lib/exercises/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { getOgUrl } from "@/lib/utils/metadata";
import { ExerciseAttempt } from "./attempt";
import type { ExerciseRouteData } from "./page-data";
import { SingleExerciseArticle } from "./rendered-article";

/** Renders the standalone single-exercise variant for one learn route. */
export async function SingleExercisePage({
  category,
  data,
  locale,
  type,
}: {
  category: ExercisesCategory;
  data: Extract<ExerciseRouteData, { kind: "single" }>;
  locale: Locale;
  type: ExercisesType;
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });
  const exerciseLabel = t("number-count", { count: data.exercise.number });
  const exerciseId = slugify(exerciseLabel);
  const description = `${t("exercises")} - ${data.exercise.question.metadata.title} - ${data.currentMaterialItem.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt =
    formatContentDateISO(data.exercise.question.metadata.date) ??
    data.exercise.question.metadata.date;
  const pagination = getExerciseNumberPagination(
    data.setPath,
    data.exercise.number,
    data.exerciseCount,
    (number) => t("number-count", { count: number })
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={[
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${data.setPath}`,
            position: 1,
            name: data.currentMaterialItem.title,
            item: `https://nakafa.com/${locale}${data.setPath}`,
          },
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${data.exerciseFilePath}`,
            position: 2,
            name: data.exercise.question.metadata.title,
            item: `https://nakafa.com/${locale}${data.exerciseFilePath}`,
          },
        ]}
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
        image={getOgUrl(locale, data.exerciseFilePath)}
        url={`/${locale}${data.exerciseFilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: data.setPath,
              label: data.currentMaterialItem.title,
            }}
            title={data.exercise.question.metadata.title}
          />
          <LayoutMaterialMain>
            <ExerciseAttempt totalExercises={data.exerciseCount} />
            <SingleExerciseArticle
              exercise={data.exercise}
              locale={locale}
              setPath={data.setPath}
              srLabel={exerciseLabel}
            />
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter>
            <DeferredComments slug={data.exerciseFilePath} />
          </LayoutMaterialFooter>
          <DeferredAiSheetOpen />
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
            description: data.currentMaterialItem.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
