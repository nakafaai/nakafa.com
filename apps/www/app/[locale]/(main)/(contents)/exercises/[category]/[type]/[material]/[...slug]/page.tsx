import {
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import { getExercisesContent } from "@repo/contents/_lib/utils";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { cn, slugify } from "@repo/design-system/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import {
  LayoutMaterial,
  LayoutMaterialContent,
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

type Params = {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  slug: string[];
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, type, material, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const materialPath = getMaterialPath(category, type, material);
  const FilePath = getSlugPath(category, type, material, slug);

  const materials = await getMaterials(materialPath, locale);

  // Find material and item in a single pass
  let materialTitle: string | undefined;

  for (const mat of materials) {
    const foundItem = mat.items.find((itm) => itm.href === FilePath);
    if (foundItem) {
      materialTitle = mat.title;
      break;
    }
  }

  const title = `${t(material)} - ${t(type)} - ${t(category)}`;
  const finalTitle = materialTitle ? `${materialTitle} - ${title}` : title;
  const urlPath = `/${locale}${FilePath}`;
  const image = {
    url: getOgUrl(locale, FilePath),
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
    // TODO: get specific exercise
    return null;
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

    // Find material and item in a single pass
    let currentMaterial: (typeof materials)[number] | undefined;
    let currentMaterialItem:
      | (typeof materials)[number]["items"][number]
      | undefined;

    for (const mat of materials) {
      const foundItem = mat.items.find((itm) => itm.href === FilePath);
      if (foundItem) {
        currentMaterial = mat;
        currentMaterialItem = foundItem;
        break;
      }
    }

    if (!(currentMaterial && currentMaterialItem)) {
      notFound();
    }

    const headings: ParsedHeading[] = exercises.map((exercise) => ({
      label: t("number-count", { count: exercise.number }),
      href: `#${slugify(t("number-count", { count: exercise.number }))}`,
    }));

    return (
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: materialPath,
              label: currentMaterial.title,
            }}
            title={currentMaterialItem.title}
          />

          <LayoutMaterialMain>
            <ExerciseContextProvider
              setId={FilePath}
              totalExercises={exercises.length}
            >
              {exercises.map((exercise) => {
                const id = slugify(
                  t("number-count", { count: exercise.number })
                );
                return (
                  <section className={cn("mb-6 pb-6")} key={exercise.number}>
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
                          <h2 className="sr-only">
                            {t("number-count", { count: exercise.number })}
                          </h2>
                        </div>
                      </a>
                      <ExerciseAnswerAction exerciseNumber={exercise.number} />
                    </div>

                    <section className="my-6">
                      {exercise.question.default}
                    </section>

                    <ExerciseChoices
                      choices={exercise.choices[locale]}
                      exerciseNumber={exercise.number}
                      id={id}
                    />

                    <ExerciseAnswer exerciseNumber={exercise.number}>
                      {exercise.answer.default}
                    </ExerciseAnswer>
                  </section>
                );
              })}
            </ExerciseContextProvider>
          </LayoutMaterialMain>
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
        />
      </LayoutMaterial>
    );
  } catch {
    notFound();
  }
}
