import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/utils";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
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
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { getOgUrl } from "@/lib/utils/metadata";
import { isNumber } from "@/lib/utils/number";
import { getStaticParams } from "@/lib/utils/system";
import { ExerciseAnswerAction } from "./actions";
import { ExerciseAnswer } from "./answer";
import { ExerciseChoices } from "./choices";

export const revalidate = false;

interface Params {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  slug: string[];
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
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const materialPath = getMaterialPath(category, type, material);

  // Check if last slug is a number (specific exercise)
  const lastSlug = slug.at(-1);
  const isSpecificExercise = lastSlug && isNumber(lastSlug);

  const baseSlug = isSpecificExercise ? slug.slice(0, -1) : slug;
  const FilePath = getSlugPath(category, type, material, baseSlug);
  const fullPath = getSlugPath(category, type, material, slug);

  let exerciseTitle: string | undefined;
  if (isSpecificExercise) {
    const exerciseNumber = Number.parseInt(lastSlug, 10);
    const exercise = await getExerciseByNumber(
      locale,
      FilePath,
      exerciseNumber
    );
    if (exercise) {
      exerciseTitle = exercise.question.metadata.title;
    }
  }

  const materials = await getMaterials(materialPath, locale);

  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    FilePath,
    materials
  );

  const title = `${t(material)} - ${t(type)} - ${t(category)}`;
  let finalTitle = currentMaterial
    ? `${currentMaterial.title} - ${title}`
    : title;

  // Prepend item title if available
  if (currentMaterialItem) {
    finalTitle = `${currentMaterialItem.title} - ${finalTitle}`;
  }

  // Prepend exercise title if it's a specific exercise
  if (isSpecificExercise && exerciseTitle) {
    finalTitle = `${exerciseTitle} - ${finalTitle}`;
  }

  // Use full slug path for URL and image if it's a specific exercise
  const urlPath = `/${locale}${fullPath}`;
  const imagePath = fullPath;
  const image = {
    url: getOgUrl(locale, imagePath),
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: finalTitle,
    },
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

  try {
    const [exercises, materials] = await Promise.all([
      getExercisesContent(locale, FilePath),
      getMaterials(materialPath, locale),
    ]);

    if (!exercises) {
      notFound();
    }

    const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
      FilePath,
      materials
    );

    if (!(currentMaterial && currentMaterialItem)) {
      notFound();
    }

    const headings: ParsedHeading[] = exercises.map((exercise) => ({
      label: t("number-count", { count: exercise.number }),
      href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    }));

    return (
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
            <ExerciseContextProvider
              setId={FilePath}
              totalExercises={exercises.length}
            >
              {exercises.map((exercise) => {
                const id = slugify(
                  t("number-count", { count: exercise.number })
                );
                return (
                  <article
                    aria-labelledby={`exercise-${id}-title`}
                    key={exercise.number}
                  >
                    <div className="flex items-center gap-4">
                      <a
                        className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
                        href={`#${id}`}
                        id={id}
                      >
                        <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                          <span className="font-mono text-xs tracking-tighter">
                            {exercise.number}
                          </span>
                          <h2 className="sr-only" id={`exercise-${id}-title`}>
                            {t("number-count", { count: exercise.number })}
                          </h2>
                        </div>
                      </a>
                      <ExerciseAnswerAction exerciseNumber={exercise.number} />
                    </div>

                    <section className="my-6">
                      {exercise.question.default}
                    </section>

                    <section className="my-8">
                      <ExerciseChoices
                        choices={exercise.choices[locale]}
                        exerciseNumber={exercise.number}
                        id={id}
                      />
                    </section>

                    <ExerciseAnswer exerciseNumber={exercise.number}>
                      {exercise.answer.default}
                    </ExerciseAnswer>
                  </article>
                );
              })}
            </ExerciseContextProvider>
          </LayoutMaterialMain>
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
    );
  } catch {
    notFound();
  }
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

  const materialPath = getMaterialPath(category, type, material);
  const FilePath = getSlugPath(category, type, material, slug);
  const exerciseFilePath = `${FilePath}/${exerciseNumber}`;

  try {
    const [exercise, materials] = await Promise.all([
      getExerciseByNumber(locale, FilePath, exerciseNumber),
      getMaterials(materialPath, locale),
    ]);

    if (!exercise) {
      notFound();
    }

    const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
      FilePath,
      materials
    );

    if (!(currentMaterial && currentMaterialItem)) {
      notFound();
    }

    const id = slugify(t("number-count", { count: exercise.number }));

    return (
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
            <ExerciseContextProvider setId={FilePath} totalExercises={1}>
              <article aria-labelledby={`exercise-${id}-title`}>
                <div className="flex items-center gap-4">
                  <a
                    className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
                    href={`#${id}`}
                    id={id}
                  >
                    <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                      <span className="font-mono text-xs tracking-tighter">
                        {exercise.number}
                      </span>
                      <h2 className="sr-only" id={`exercise-${id}-title`}>
                        {t("number-count", { count: exercise.number })}
                      </h2>
                    </div>
                  </a>
                  <ExerciseAnswerAction exerciseNumber={exercise.number} />
                </div>

                <section className="my-6">{exercise.question.default}</section>

                <section className="my-8">
                  <ExerciseChoices
                    choices={exercise.choices[locale]}
                    exerciseNumber={exercise.number}
                    id={id}
                  />
                </section>

                <ExerciseAnswer exerciseNumber={exercise.number}>
                  {exercise.answer.default}
                </ExerciseAnswer>
              </article>
            </ExerciseContextProvider>
          </LayoutMaterialMain>
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
    );
  } catch {
    notFound();
  }
}
