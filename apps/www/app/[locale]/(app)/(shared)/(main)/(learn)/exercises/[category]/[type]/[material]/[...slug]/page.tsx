import {
  getSlugPath,
  hasInvalidTryOutYearSlug,
  isYearlessTryOutCollectionSlug,
  LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
} from "@repo/contents/_lib/exercises/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getExerciseRouteData,
  getResolvedParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/exercises/[category]/[type]/[material]/[...slug]/data";
import { YearGroupPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/exercises/[category]/[type]/[material]/[...slug]/group";
import { ExerciseSetPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/exercises/[category]/[type]/[material]/[...slug]/set";
import { SingleExercisePage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/exercises/[category]/[type]/[material]/[...slug]/single";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

const missingExerciseRouteData = { kind: "missing" } as const;

/** Generates SEO metadata for one learn-exercises route. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, type, material, slug } =
    await getResolvedParams(params);
  const legacyTryOutRedirectPath = getLegacyTryOutRedirectPath({
    category,
    locale,
    material,
    slug,
    type,
  });

  if (legacyTryOutRedirectPath) {
    permanentRedirect(legacyTryOutRedirectPath);
  }

  const data = await getExerciseRouteData(
    locale,
    category,
    type,
    material,
    slug.join("/")
  ).then(
    (routeData) => routeData,
    () => missingExerciseRouteData
  );

  if (data.kind === "missing") {
    notFound();
  }

  const urlPath = `/${locale}${data.pagePath}`;
  const exerciseNumber =
    data.kind === "single" ? data.exercise.number : undefined;
  let exerciseCount = 0;

  if (data.kind === "single") {
    exerciseCount = data.exerciseCount;
  }

  if (data.kind === "set") {
    exerciseCount = data.exercises.length;
  }

  const exerciseTitle =
    data.kind === "single" ? data.exercise.question.metadata.title : undefined;

  const seoContext: SEOContext = {
    type: "exercise",
    category,
    exam: type,
    material,
    group: data.currentMaterial?.title,
    set: data.currentMaterialItem?.title,
    number: exerciseNumber,
    questionCount: exerciseCount,
    data: {
      title:
        exerciseTitle ??
        data.currentMaterialItem?.title ??
        data.currentMaterial?.title,
      description: undefined,
      subject: material,
    },
  };

  const {
    title: finalTitle,
    description,
    keywords,
  } = await generateSEOMetadata(seoContext, locale);
  const socialMetadata = getSocialMetadata({
    title: finalTitle,
    description,
    locale,
    path: urlPath,
    image: getOgUrl(locale, data.pagePath),
  });

  return {
    title: {
      absolute: finalTitle,
    },
    description,
    keywords,
    alternates: createLocalizedAlternates(urlPath, {
      types: {
        "text/markdown": `${urlPath}.md`,
      },
    }),
    ...socialMetadata,
  };
}

/** Enumerates the prerenderable learn-exercises paths. */
export async function generateStaticParams() {
  const staticParams = await getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });

  return staticParams.filter((params) => {
    const slug = params.slug;
    return (
      Array.isArray(slug) &&
      slug.length <= 3 &&
      !isYearlessTryOutCollectionSlug(slug)
    );
  });
}

/** Selects and renders the explicit learn-exercises page variant for this route. */
export default async function Page({
  params,
}: PageProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">) {
  const { locale, category, type, material, slug } =
    await getResolvedParams(params);
  const legacyTryOutRedirectPath = getLegacyTryOutRedirectPath({
    category,
    locale,
    material,
    slug,
    type,
  });

  if (legacyTryOutRedirectPath) {
    permanentRedirect(legacyTryOutRedirectPath);
  }

  const data = await getExerciseRouteData(
    locale,
    category,
    type,
    material,
    slug.join("/")
  );

  switch (data.kind) {
    case "single":
      return (
        <SingleExercisePage
          category={category}
          data={data}
          locale={locale}
          material={material}
          type={type}
        />
      );
    case "set":
      return (
        <ExerciseSetPage
          category={category}
          data={data}
          locale={locale}
          material={material}
          type={type}
        />
      );
    case "year-group":
      return (
        <YearGroupPage
          category={category}
          data={data}
          locale={locale}
          material={material}
          type={type}
        />
      );
    default:
      notFound();
  }
}

/** Returns the canonical target for migrated yearless try-out URLs. */
function getLegacyTryOutRedirectPath({
  category,
  locale,
  material,
  slug,
  type,
}: Awaited<ReturnType<typeof getResolvedParams>>) {
  if (!hasInvalidTryOutYearSlug(slug)) {
    return null;
  }

  const canonicalPath = getSlugPath(category, type, material, [
    "try-out",
    LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
    ...slug.slice(1),
  ]);

  return `/${locale}${canonicalPath}`;
}
