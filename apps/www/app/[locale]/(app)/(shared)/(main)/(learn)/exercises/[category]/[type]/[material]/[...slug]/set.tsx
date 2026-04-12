import { getExercisesPagination } from "@repo/contents/_lib/exercises/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ExerciseTrackedEntry } from "@/components/exercise/entry";
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
import type { ExerciseRouteData } from "./data";

/** Renders the exercise-set variant for one learn route. */
export async function ExerciseSetPage({
  category,
  data,
  locale,
  type,
}: {
  category: ExercisesCategory;
  data: Extract<ExerciseRouteData, { kind: "set" }>;
  locale: Locale;
  type: ExercisesType;
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });
  const pagination = getExercisesPagination(data.pagePath, data.materials);
  const headings: ParsedHeading[] = data.exercises.map((exercise) => ({
    label: t("number-count", { count: exercise.number }),
    href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    children: [],
  }));
  const description = `${t("exercises")} - ${data.currentMaterialItem.title} - ${data.currentMaterial.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt =
    formatContentDateISO(data.exercises[0].question.metadata.date) ??
    data.exercises[0].question.metadata.date;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={headings.map((heading, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${data.pagePath}${heading.href}`,
          position: index + 1,
          name: heading.label,
          item: `https://nakafa.com/${locale}${data.pagePath}${heading.href}`,
        }))}
      />
      <LearningResourceJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        educationalLevel={educationalLevel}
        name={data.currentMaterialItem.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        headline={data.currentMaterialItem.title}
        image={getOgUrl(locale, data.pagePath)}
        url={`/${locale}${data.pagePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: data.materialPath,
              label: data.currentMaterial.title,
            }}
            title={data.currentMaterialItem.title}
          />
          <LayoutMaterialMain as="section" className="space-y-12">
            <ExerciseAttempt totalExercises={data.exercises.length} />

            {data.exercises.map((exercise) => (
              <ExerciseTrackedEntry
                exercise={exercise}
                key={exercise.number}
                locale={locale}
                setPath={data.pagePath}
                srLabel={t("number-count", { count: exercise.number })}
              />
            ))}
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter>
            <DeferredComments slug={data.pagePath} />
          </LayoutMaterialFooter>
          <DeferredAiSheetOpen />
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: headings,
          }}
          header={{
            title: data.currentMaterialItem.title,
            href: data.pagePath,
            description: data.currentMaterial.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
