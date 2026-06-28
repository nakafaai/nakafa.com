import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { readPracticeSetDisplay } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/display";
import {
  readExerciseSetSourceParts,
  readQuestionSourcePathParts,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";
import type { ContentSEOData, SEOContext } from "@/lib/utils/seo/types";

type ExerciseSetSourceParts = ReturnType<typeof readExerciseSetSourceParts>;
interface PracticeSetRouteForSeo {
  readonly description?: string;
  readonly kind: "exercise-set";
  readonly locale: Locale;
  readonly publicPath: string;
  readonly sourcePath: string;
}
interface PracticeQuestionRouteForSeo {
  readonly description?: string;
  readonly kind: "exercise-question";
  readonly locale: Locale;
  readonly parentPath: string;
  readonly sourcePath: string;
}
type PracticeRouteForSeo = PracticeSetRouteForSeo | PracticeQuestionRouteForSeo;

/** Builds domain-level SEO context from a projected practice domain route. */
export function readPracticeDomainSeoContext(
  route: PracticeSetRouteForSeo
): Extract<SEOContext, { type: "exercise" }> {
  const sourceParts = readExerciseSetSourceParts(route.sourcePath);

  return createPracticeSEOContext({
    sourceParts,
    data: { title: sourceParts.material },
  });
}

/** Builds dictionary-backed SEO context from a projected practice set/question route. */
export function readPracticeRouteSeoContext(
  route: PracticeRouteForSeo,
  routes: readonly PracticeSetRouteForSeo[]
): Extract<SEOContext, { type: "exercise" }> {
  if (route.kind === "exercise-set") {
    const display = readPracticeSetDisplay(route);

    return createPracticeSEOContext({
      sourceParts: readExerciseSetSourceParts(route.sourcePath),
      group: display.groupTitle,
      set: display.setTitle,
      data: {
        title: display.setTitle,
        description: route.description,
      },
    });
  }

  const setRoute = routes.find(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.publicPath === route.parentPath
  );

  if (!setRoute) {
    notFound();
  }

  const display = readPracticeSetDisplay(setRoute);
  const { questionNumber } = readQuestionSourcePathParts(route.sourcePath);

  return createPracticeSEOContext({
    sourceParts: readExerciseSetSourceParts(setRoute.sourcePath),
    group: display.groupTitle,
    number: questionNumber,
    set: display.setTitle,
    data: {
      title: display.setTitle,
      description: route.description,
    },
  });
}

/** Normalizes practice source parts into the shared SEO generator context. */
function createPracticeSEOContext({
  data,
  group,
  number,
  set,
  sourceParts,
}: {
  data: ContentSEOData;
  group?: string;
  number?: number;
  set?: string;
  sourceParts: ExerciseSetSourceParts;
}): Extract<SEOContext, { type: "exercise" }> {
  return {
    type: "exercise",
    category: sourceParts.category,
    exam: sourceParts.type,
    material: sourceParts.material,
    group,
    set,
    number,
    data,
  };
}
