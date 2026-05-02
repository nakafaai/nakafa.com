import { captureServerException } from "@repo/analytics/posthog/server";
import {
  getSlugPath,
  hasInvalidTryOutYearSlug,
  isYearlessTryOutCollectionSlug,
  LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
} from "@repo/contents/_lib/exercises/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getOgUrl } from "@/lib/utils/metadata";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";
import { getExerciseRouteData, getResolvedParams } from "./data";
import { YearGroupPage } from "./group";
import { ExerciseSetPage } from "./set";
import { SingleExercisePage } from "./single";

/** Generates SEO metadata for one learn-exercises route. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, type, material, slug } =
    await getResolvedParams(params);
  const pagePath = getSlugPath(category, type, material, slug);
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
  ).catch(async (error) => {
    await captureServerException(error, undefined, {
      locale,
      page_path: pagePath,
      source: "exercise-route-metadata",
    });

    notFound();
  });

  if (data.kind === "missing") {
    notFound();
  }

  const urlPath = `/${locale}${data.pagePath}`;
  const image = {
    url: getOgUrl(locale, data.pagePath),
    width: 1200,
    height: 630,
  };

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

  return {
    title: {
      absolute: finalTitle,
    },
    description,
    keywords,
    alternates: {
      canonical: urlPath,
      types: {
        "text/markdown": `${urlPath}.md`,
      },
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

/** Enumerates the prerenderable learn-exercises paths. */
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
          type={type}
        />
      );
    case "set":
      return (
        <ExerciseSetPage
          category={category}
          data={data}
          locale={locale}
          type={type}
        />
      );
    case "year-group":
      return (
        <YearGroupPage
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
