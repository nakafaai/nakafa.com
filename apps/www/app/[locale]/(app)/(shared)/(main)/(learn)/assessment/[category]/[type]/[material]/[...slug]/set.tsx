import { getExercisesPath } from "@repo/contents/_lib/assessment/route";
import { getExercisesPagination } from "@repo/contents/_lib/assessment/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import type { ParsedHeading } from "@repo/contents/_types/toc";
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
import { ExerciseTrackedEntry } from "@/components/exercise/entry";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { getOgUrl } from "@/lib/utils/metadata";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Renders the exercise-set variant for one learn route. */
export async function ExerciseSetPage({
  category,
  data,
  locale,
  material,
  type,
}: {
  category: ExercisesCategory;
  data: Extract<ExerciseRouteData, { kind: "set" }>;
  locale: Locale;
  material: ExercisesMaterial;
  type: ExercisesType;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const typePath = getExercisesPath(category, type);
  const pagination = getExercisesPagination(data.pagePath, data.materials);
  const headings: ParsedHeading[] = data.exercises.map((exercise) => ({
    label: t("number-count", { count: exercise.number }),
    href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    children: [],
  }));
  const description = `${t("exercises")} - ${data.currentMaterialItem.title} - ${data.currentMaterial.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt = Option.getOrElse(
    formatContentDateISO(data.exercises[0].question.metadata.date),
    () => data.exercises[0].question.metadata.date
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(type), path: typePath },
          { name: t(material), path: data.materialPath },
          { name: data.currentMaterial.title, path: data.currentMaterial.href },
          { name: data.currentMaterialItem.title, path: data.pagePath },
        ])}
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
          <HeaderContent
            link={{
              href: data.materialPath,
              label: data.currentMaterial.title,
            }}
            title={data.currentMaterialItem.title}
          />
          <LayoutContent as="section" className="space-y-12">
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
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>
            <DeferredComments slug={data.pagePath} />
          </FooterContent>
          <DeferredAiSheetOpen contextTitle={data.currentMaterialItem.title} />
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
