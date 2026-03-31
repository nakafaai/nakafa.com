import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises";
import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import {
  getExerciseNumberPagination,
  getExercisesPagination,
  getSlugPath,
  hasInvalidTryOutYearSlug,
  isTryOutCollectionSlug,
  isYearlessTryOutCollectionSlug,
  LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
} from "@repo/contents/_lib/exercises/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
import type { Exercise } from "@repo/contents/_types/exercises/shared";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { AiSheetOpen } from "@/components/ai/sheet-open";
import { Comments } from "@/components/comments";
import { CardMaterial } from "@/components/shared/card-material";
import { ComingSoon } from "@/components/shared/coming-soon";
import { ContainerList } from "@/components/shared/container-list";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { isNumber } from "@/lib/utils/number";
import {
  fetchExerciseContext,
  fetchExerciseMetadataContext,
} from "@/lib/utils/pages/exercises";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";
import { QuestionAnalytics } from "./analytics";
import { ExerciseArticle } from "./article";
import { ExerciseAttempt } from "./attempt";

export const dynamicParams = true;
export const revalidate = false;

interface Params {
  category: ExercisesCategory;
  locale: Locale;
  material: ExercisesMaterial;
  slug: string[];
  type: ExercisesType;
}

interface Props {
  params: Promise<Params>;
}

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, type, material, slug } = await params;

  const {
    isSpecificExercise,
    exerciseTitle,
    exerciseCount,
    FilePath,
    currentMaterial,
    currentMaterialItem,
  } = await Effect.runPromise(
    Effect.match(
      fetchExerciseMetadataContext({ locale, category, type, material, slug }),
      {
        onFailure: () => ({
          isSpecificExercise: false,
          exerciseTitle: undefined,
          exerciseCount: 0,
          FilePath: getSlugPath(category, type, material, slug),
          currentMaterial: undefined,
          currentMaterialItem: undefined,
        }),
        onSuccess: (data) => data,
      }
    )
  );

  const urlPath = `/${locale}${FilePath}`;
  const image = {
    url: getOgUrl(locale, FilePath),
    width: 1200,
    height: 630,
  };

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  // Get exercise type and set names from material data (e.g., "Try Out", "Set 1")
  const group = currentMaterial?.title;
  const set = currentMaterialItem?.title;

  // Extract exercise number from slug for specific exercises (e.g., /set-2/1)
  const lastSlug = slug.at(-1);
  const exerciseNumber =
    isSpecificExercise && lastSlug && isNumber(lastSlug)
      ? Number.parseInt(lastSlug, 10)
      : undefined;

  const seoContext: SEOContext = {
    type: "exercise",
    category,
    exam: type,
    material,
    group,
    set,
    number: exerciseNumber,
    questionCount: exerciseCount, // Total count from filesystem
    data: {
      title:
        exerciseTitle ?? currentMaterialItem?.title ?? currentMaterial?.title,
      description: undefined,
      subject: material,
    },
  };

  const {
    title: finalTitle,
    description,
    keywords,
  } = await generateSEOMetadata(seoContext, locale);

  return {
    title: {
      absolute: finalTitle,
    },
    description,
    keywords,
    alternates: {
      canonical: urlPath,
    },
    openGraph: {
      title: finalTitle,
      url: urlPath,
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
    paramNames: ["category", "type", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  }).filter((params) => {
    const slug = params.slug;
    return (
      Array.isArray(slug) &&
      slug.length <= 3 &&
      !isYearlessTryOutCollectionSlug(slug)
    );
  });
}

export default function Page({ params }: Props) {
  const { locale, category, type, material, slug } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  if (hasInvalidTryOutYearSlug(slug)) {
    const tryOutSuffixIndex = 1;
    const legacyTryOutSuffix = slug.slice(tryOutSuffixIndex);

    // Legacy yearless try-out URLs were already indexed before the year segment
    // migration, so keep forwarding them to their yearful 2026 successor.
    permanentRedirect(
      getSlugPath(category, type, material, [
        "try-out",
        LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
        ...legacyTryOutSuffix,
      ])
    );
  }

  const lastSlug = slug.at(-1);
  // Try-out collection routes like `try-out/2026` end in a number but should
  // still render the collection page, not a single exercise page.
  if (!isTryOutCollectionSlug(slug) && lastSlug && isNumber(lastSlug)) {
    const exerciseNumber = Number.parseInt(lastSlug, 10);
    const baseSlug = slug.slice(0, -1);
    return (
      <SingleExerciseContent
        category={category}
        exerciseNumber={exerciseNumber}
        locale={locale}
        material={material}
        slug={baseSlug}
        type={type}
      />
    );
  }

  return (
    <PageContent
      category={category}
      locale={locale}
      material={material}
      slug={slug}
      type={type}
    />
  );
}

async function YearGroupContent({
  currentMaterial,
  FilePath,
  locale,
  material,
  materialPath,
  type,
}: {
  currentMaterial: ExercisesMaterialList[number];
  FilePath: string;
  locale: Locale;
  material: ExercisesMaterial;
  materialPath: string;
  type: ExercisesType;
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });
  const headingId = slugify(currentMaterial.title);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={currentMaterial.items.map((item, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${item.href}`,
          position: index + 1,
          name: item.title,
          item: `https://nakafa.com/${locale}${item.href}`,
        }))}
      />
      <CollectionPageJsonLd
        description={currentMaterial.description ?? t(type)}
        items={currentMaterial.items.map((item) => ({
          url: `https://nakafa.com/${locale}${item.href}`,
          name: item.title,
        }))}
        name={`${t(material)} - ${currentMaterial.title}`}
        url={`https://nakafa.com/${locale}${FilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: materialPath,
              label: t(material),
            }}
            title={currentMaterial.title}
          />
          <LayoutMaterialMain>
            <ContainerList className="sm:grid-cols-1">
              <CardMaterial material={currentMaterial} />
            </ContainerList>
          </LayoutMaterialMain>
          <LayoutMaterialFooter>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents${FilePath}`,
              })}
            />
          </LayoutMaterialFooter>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: [
              {
                label: currentMaterial.title,
                href: `#${headingId}`,
                children: [],
              },
            ],
          }}
          header={{
            title: currentMaterial.title,
            href: FilePath,
            description: currentMaterial.description ?? t(type),
          }}
        />
      </LayoutMaterial>
    </>
  );
}

async function PageContent({
  locale,
  category,
  type,
  material,
  slug,
}: {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  slug: string[];
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const materialPath = getMaterialPath(category, type, material);
  const FilePath = getSlugPath(category, type, material, slug);
  const materialGroups = await getMaterials(materialPath, locale);
  const { currentMaterial: matchedMaterial, currentMaterialItem: matchedItem } =
    getCurrentMaterial(FilePath, materialGroups);

  if (matchedMaterial && !matchedItem) {
    return (
      <YearGroupContent
        currentMaterial={matchedMaterial}
        FilePath={FilePath}
        locale={locale}
        material={material}
        materialPath={materialPath}
        type={type}
      />
    );
  }

  const exercises = await Effect.runPromise(
    Effect.match(getExercisesContent({ locale, filePath: FilePath }), {
      onFailure: () => [],
      onSuccess: (data) => data,
    })
  );

  if (exercises.length === 0 || !matchedMaterial || !matchedItem) {
    return (
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialMain className="py-24">
            <ComingSoon />
          </LayoutMaterialMain>
        </LayoutMaterialContent>
      </LayoutMaterial>
    );
  }

  const currentMaterial = matchedMaterial;
  const currentMaterialItem = matchedItem;
  const materials = materialGroups;

  const pagination = getExercisesPagination(FilePath, materials);

  const headings: ParsedHeading[] = exercises.map((exercise) => ({
    label: t("number-count", { count: exercise.number }),
    href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    children: [],
  }));

  const description = `${t("exercises")} - ${currentMaterialItem.title} - ${currentMaterial.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt =
    formatContentDateISO(exercises[0].question.metadata.date) ??
    exercises[0].question.metadata.date;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={headings.map((heading, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${FilePath}${heading.href}`,
          position: index + 1,
          name: heading.label,
          item: `https://nakafa.com/${locale}${FilePath}${heading.href}`,
        }))}
      />
      <LearningResourceJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        educationalLevel={educationalLevel}
        name={currentMaterialItem.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        headline={currentMaterialItem.title}
        image={getOgUrl(locale, FilePath)}
        url={`/${locale}${FilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: materialPath,
              label: currentMaterial.title,
            }}
            title={currentMaterialItem.title}
          />

          <LayoutMaterialMain as="section" className="space-y-12">
            <ExerciseAttempt totalExercises={exercises.length} />

            {exercises.map((exercise) => {
              const id = slugify(t("number-count", { count: exercise.number }));

              return (
                <QuestionAnalytics
                  exerciseNumber={exercise.number}
                  key={exercise.number}
                >
                  <ExerciseArticle
                    exercise={exercise}
                    id={id}
                    locale={locale}
                    srLabel={t("number-count", { count: exercise.number })}
                  />
                </QuestionAnalytics>
              );
            })}
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter>
            <Comments slug={FilePath} />
          </LayoutMaterialFooter>
          <AiSheetOpen />
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: headings,
          }}
          header={{
            title: currentMaterialItem.title,
            href: FilePath,
            description: currentMaterial.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}

async function SingleExerciseContent({
  locale,
  category,
  type,
  material,
  slug,
  exerciseNumber,
}: {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  slug: string[];
  exerciseNumber: number;
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getSlugPath(category, type, material, slug);
  const exerciseFilePath = `${FilePath}/${exerciseNumber}`;

  const singleExerciseEffect = Effect.all([
    getExerciseByNumber(locale, FilePath, exerciseNumber),
    fetchExerciseContext({ locale, category, type, material, slug }),
    getExercisesContent({ locale, filePath: FilePath }),
  ]);

  const [exerciseOption, exerciseContext, exercises] = await Effect.runPromise(
    Effect.match(singleExerciseEffect, {
      onFailure: () => {
        const emptyResult: [Option.Option<Exercise>, null, null] = [
          Option.none(),
          null,
          null,
        ];
        return emptyResult;
      },
      onSuccess: (data) => data,
    })
  );

  if (Option.isNone(exerciseOption) || !exerciseContext) {
    return (
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialMain className="py-24">
            <ComingSoon />
          </LayoutMaterialMain>
        </LayoutMaterialContent>
      </LayoutMaterial>
    );
  }

  const exercise = exerciseOption.value;

  const { currentMaterialItem } = exerciseContext;

  const totalExercises = exercises?.length ?? 0;
  const pagination = getExerciseNumberPagination(
    FilePath,
    exerciseNumber,
    totalExercises,
    (number) => t("number-count", { count: number })
  );

  const id = slugify(t("number-count", { count: exercise.number }));

  const description = `${t("exercises")} - ${exercise.question.metadata.title} - ${currentMaterialItem.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;
  const publishedAt =
    formatContentDateISO(exercise.question.metadata.date) ??
    exercise.question.metadata.date;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={[
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${FilePath}`,
            position: 1,
            name: currentMaterialItem.title,
            item: `https://nakafa.com/${locale}${FilePath}`,
          },
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${exerciseFilePath}`,
            position: 2,
            name: exercise.question.metadata.title,
            item: `https://nakafa.com/${locale}${exerciseFilePath}`,
          },
        ]}
      />
      <LearningResourceJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        educationalLevel={educationalLevel}
        name={exercise.question.metadata.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={publishedAt}
        description={description}
        headline={exercise.question.metadata.title}
        image={getOgUrl(locale, exerciseFilePath)}
        url={`/${locale}${exerciseFilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: FilePath,
              label: currentMaterialItem.title,
            }}
            title={exercise.question.metadata.title}
          />

          <LayoutMaterialMain>
            <ExerciseAttempt totalExercises={totalExercises} />

            <ExerciseArticle
              exercise={exercise}
              id={id}
              locale={locale}
              srLabel={t("number-count", { count: exercise.number })}
            />
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter>
            <Comments slug={exerciseFilePath} />
          </LayoutMaterialFooter>
          <AiSheetOpen />
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: [
              {
                label: t("number-count", { count: exercise.number }),
                href: `#${id}`,
                children: [],
              },
            ],
          }}
          header={{
            title: exercise.question.metadata.title,
            href: exerciseFilePath,
            description: currentMaterialItem.title,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
