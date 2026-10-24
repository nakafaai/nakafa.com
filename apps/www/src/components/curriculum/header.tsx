import {
  CURRICULA_TARGET,
  curriculumPublicPathTarget,
  HOME_TARGET,
} from "@repo/internationalization/src/target";
import { Array as Arr, Option } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";

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
        home: { host: "app", target: HOME_TARGET },
        homeLabel,
        items: [
          {
            label: subjectLabel,
            target: { host: "app", target: CURRICULA_TARGET },
          },
          ...Arr.map(ancestors, (ancestor) => ({
            label: ancestor.title,
            target: Option.getOrUndefined(
              Option.map(
                Option.fromNullishOr(
                  curriculumPublicPathTarget(ancestor.publicPath)
                ),
                (target) => ({ host: "app" as const, target })
              )
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
