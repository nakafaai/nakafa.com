import { Array as Arr, Option } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";
import {
  CURRICULA_TARGET,
  curriculumPublicPathTarget,
  HOME_TARGET,
} from "@/lib/routing/target";

/** Renders one nested curriculum route with breadcrumb context only. */
export function CurriculumNestedHeader({
  ancestors,
  currentRoute,
  homeLabel,
  menuLabel,
  subjectLabel,
}: {
  ancestors: readonly CurriculumViewRoute[];
  currentRoute: CurriculumViewRoute;
  homeLabel: string;
  menuLabel: string;
  subjectLabel: string;
}) {
  return (
    <BreadcrumbHeader
      value={{
        home: HOME_TARGET,
        homeLabel,
        items: [
          {
            label: subjectLabel,
            target: CURRICULA_TARGET,
          },
          ...Arr.map(ancestors, (ancestor) => ({
            label: ancestor.title,
            target: Option.getOrUndefined(
              curriculumPublicPathTarget(ancestor.publicPath)
            ),
          })),
          { label: currentRoute.title },
        ],
        menuLabel,
        title: currentRoute.title,
      }}
    />
  );
}
