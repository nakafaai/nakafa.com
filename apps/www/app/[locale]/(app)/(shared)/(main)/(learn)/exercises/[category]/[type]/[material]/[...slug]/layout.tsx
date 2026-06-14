import {
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import { getExerciseSetRoute } from "@repo/contents/_types/graph/projection";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import type { ReactNode } from "react";

import { ContentViewTracker } from "@/components/tracking/tracker";
import { getRuntimeContentViewId } from "@/lib/content/views";
import { AttemptContextProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Runtime context providers required by exercise set and question pages. */
function ExerciseRuntimeProviders({
  children,
  locale,
  slug,
}: {
  children: ReactNode;
  locale: Locale;
  slug: string;
}) {
  return (
    <ExerciseContextProvider key={slug} slug={slug}>
      <AttemptContextProvider locale={locale} slug={slug}>
        {children}
      </AttemptContextProvider>
    </ExerciseContextProvider>
  );
}

/** Wraps exercise pages with graph view tracking while preserving attempt context. */
export default async function Layout(
  props: LayoutProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">
) {
  const { children, params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
    material: rawMaterial,
    slug,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseExercisesCategory(rawCategory);
  const parsedType = parseExercisesType(rawType);
  const parsedMaterial = parseExercisesMaterial(rawMaterial);

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    notFound();
  }

  const category = parsedCategory.value;
  const type = parsedType.value;
  const material = parsedMaterial.value;

  const fullRoute = cleanSlug(getSlugPath(category, type, material, slug));
  const setRoute = getExerciseSetRoute(fullRoute);
  const runtimeSlug = setRoute ?? fullRoute;
  const contentId = setRoute
    ? await getRuntimeContentViewId({
        locale,
        route: setRoute,
      })
    : null;

  if (!contentId) {
    return (
      <ExerciseRuntimeProviders locale={locale} slug={runtimeSlug}>
        {children}
      </ExerciseRuntimeProviders>
    );
  }

  return (
    <ContentViewTracker contentId={contentId} locale={locale}>
      <ExerciseRuntimeProviders locale={locale} slug={runtimeSlug}>
        {children}
      </ExerciseRuntimeProviders>
    </ContentViewTracker>
  );
}
