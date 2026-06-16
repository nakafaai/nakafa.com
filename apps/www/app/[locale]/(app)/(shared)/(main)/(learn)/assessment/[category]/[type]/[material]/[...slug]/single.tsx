import { getExercisesPath } from "@repo/contents/_lib/assessment/route";
import { getExerciseNumberPagination } from "@repo/contents/_lib/assessment/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ExerciseAttempt } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/assessment/[category]/[type]/[material]/[...slug]/attempt";
import type { ExerciseRouteData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/assessment/[category]/[type]/[material]/[...slug]/data";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ExerciseEntry } from "@/components/exercise/entry";
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
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Renders the standalone single-exercise variant for one learn route. */
export async function SingleExercisePage({
  category,
  data,
  locale,
  material,
  type,
}: {
  category: ExercisesCategory;
  data: Extract<ExerciseRouteData, { kind: "single" }>;
  locale: Locale;
  material: ExercisesMaterial;
  type: ExercisesType;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const typePath = getExercisesPath(category, type);
  const exerciseLabel = t("number-count", { count: data.exercise.number });
  const exerciseId = slugify(exerciseLabel);
  const description = `${t("exercises")} - ${data.exercise.question.metadata.title} - ${data.currentMaterialItem.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt = Option.getOrElse(
    formatContentDateISO(data.exercise.question.metadata.date),
    () => data.exercise.question.metadata.date
  );
  const pagination = getExerciseNumberPagination(
    data.setPath,
    data.exercise.number,
    data.exerciseCount,
    (number) => t("number-count", { count: number })
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(type), path: typePath },
          { name: t(material), path: data.materialPath },
          { name: data.currentMaterial.title, path: data.currentMaterial.href },
          { name: data.currentMaterialItem.title, path: data.setPath },
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
            <ExerciseEntry
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
            description: data.currentMaterialItem.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
