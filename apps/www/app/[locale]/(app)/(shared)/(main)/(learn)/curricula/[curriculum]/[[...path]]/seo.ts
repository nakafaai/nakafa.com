import {
  isRenderableCurriculumRoute,
  readCurriculumAncestors,
} from "@repo/contents/_types/route/curriculum";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { readCurriculumRoutes } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import type { SEOContext } from "@/lib/utils/seo/types";

/** Builds shared SEO metadata input from one projected curriculum route. */
export function readCurriculumSeoContext(
  route: PublicCurriculumRoute
): Extract<SEOContext, { type: "curriculum-context" }> {
  const ancestors = readCurriculumAncestors(
    route,
    readCurriculumRoutes()
  ).filter(isRenderableCurriculumRoute);
  const parent = ancestors.at(-1);
  const program = ancestors.at(0);
  const parentTitle = parent?.title;
  const programTitle = program?.title;
  const programContext =
    programTitle && programTitle !== route.title && programTitle !== parentTitle
      ? programTitle
      : undefined;

  return {
    type: "curriculum-context",
    level: route.level,
    parent: parentTitle,
    program: programContext,
    data: {
      title: route.title,
      description: route.materialCardDescription,
    },
  };
}
