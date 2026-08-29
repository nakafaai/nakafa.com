import type { CurriculumViewRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
import type { SEOContext } from "@/lib/seo/contract";

/** Builds shared SEO metadata input from one projected curriculum route. */
export function readCurriculumSeoContext(
  route: CurriculumViewRoute,
  ancestors: readonly CurriculumViewRoute[]
): Extract<SEOContext, { type: "curriculum-context" }> {
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
