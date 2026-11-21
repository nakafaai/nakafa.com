import { Array as Arr, Option } from "effect";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";
import type { SEOContext } from "@/lib/seo/contract";

/**
 * Builds shared SEO metadata input from one projected curriculum route and the
 * titles of what it lists (`topics`), so its description names its own topics.
 */
export function readCurriculumSeoContext(
  route: CurriculumViewRoute,
  ancestors: readonly CurriculumViewRoute[],
  topics: readonly string[]
): Extract<SEOContext, { type: "curriculum-context" }> {
  const parentTitle = Option.getOrUndefined(
    Option.map(Arr.last(ancestors), (parent) => parent.title)
  );
  const programTitle = Option.getOrUndefined(
    Option.map(Arr.head(ancestors), (program) => program.title)
  );
  const programContext =
    programTitle && programTitle !== route.title && programTitle !== parentTitle
      ? programTitle
      : undefined;

  return {
    type: "curriculum-context",
    level: route.level,
    parent: parentTitle,
    program: programContext,
    topics,
    data: {
      title: route.title,
      description: route.materialCardDescription,
    },
  };
}
