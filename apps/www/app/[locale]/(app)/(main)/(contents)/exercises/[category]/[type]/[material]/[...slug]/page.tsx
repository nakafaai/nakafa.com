import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises";
import { getMaterialPath } from "@repo/contents/_lib/exercises/material";
import {
  getExerciseNumberPagination,
  getExercisesPagination,
  getSlugPath,
} from "@repo/contents/_lib/exercises/slug";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { Exercise } from "@repo/contents/_types/exercises/shared";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FOUNDER } from "@repo/seo/json-ld/constants";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Comments } from "@/components/comments";
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

  // Get material display name from Exercises namespace
  const tExercises = await getTranslations({ locale, namespace: "Exercises" });
  const materialDisplayName = tExercises(material);

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  // Extract set number and question count from slug if available
  const lastSlug = slug.at(-1);
  const setNumber =
    lastSlug && !Number.isNaN(Number(lastSlug)) ? Number(lastSlug) : undefined;

  const seoContext: SEOContext = {
    type: "exercise",
    category,
    exerciseType: type,
    material,
    setNumber,
    questionCount: isSpecificExercise ? 1 : 20, // Single question or collection
    data: {
      title:
        exerciseTitle ?? currentMaterialItem?.title ?? currentMaterial?.title,
      description: undefined,
      subject: material,
      displayName: materialDisplayName,
    },
  };

  const { title: finalTitle, description } = await generateSEOMetadata(
    seoContext,
    locale
  );

  return {
    title: {
      absolute: finalTitle,
    },
    description,
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
  });
}

export default function Page({ params }: Props) {
  const { locale, category, type, material, slug } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  // if last slug can be converted to a number, means it is a specific exercise
  const lastSlug = slug.at(-1);
  if (lastSlug && isNumber(lastSlug)) {
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

  const exercisesEffect = Effect.all([
    getExercisesContent({ locale, filePath: FilePath }),
    fetchExerciseContext({ locale, category, type, material, slug }),
  ]);

  const [exercises, exerciseContext] = await Effect.runPromise(
    Effect.match(exercisesEffect, {
      onFailure: () => {
        const emptyResult: [Exercise[], null] = [[], null];
        return emptyResult;
      },
      onSuccess: (data) => data,
    })
  );

  if (exercises.length === 0 || !exerciseContext) {
    notFound();
  }

  const { currentMaterial, currentMaterialItem, materials } = exerciseContext;

  const pagination = getExercisesPagination(FilePath, materials);

  const headings: ParsedHeading[] = exercises.map((exercise) => ({
    label: t("number-count", { count: exercise.number }),
    href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    children: [],
  }));

  const description = `${t("exercises")} - ${currentMaterialItem.title} - ${currentMaterial.title}`;
  const educationalLevel = `${t(type)} - ${t(category)}`;

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
        datePublished={exercises[0].question.metadata.date}
        description={description}
        educationalLevel={educationalLevel}
        name={currentMaterialItem.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={exercises[0].question.metadata.date}
        description={description}
        headline={currentMaterialItem.title}
        image={getOgUrl(locale, FilePath)}
        url={`/${locale}${FilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent showAskButton>
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
    notFound();
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
        datePublished={exercise.question.metadata.date}
        description={description}
        educationalLevel={educationalLevel}
        name={exercise.question.metadata.title}
      />
      <ArticleJsonLd
        author={FOUNDER}
        datePublished={exercise.question.metadata.date}
        description={description}
        headline={exercise.question.metadata.title}
        image={getOgUrl(locale, exerciseFilePath)}
        url={`/${locale}${exerciseFilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent showAskButton>
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
