import type { Locale } from "next-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

/** Renders one nested curriculum route with breadcrumb context only. */
export default function CurriculumNestedHeader({
  ancestors,
  currentRoute,
  homeLabel,
  locale,
  menuLabel,
  subjectLabel,
}: {
  ancestors: readonly CurriculumViewRoute[];
  currentRoute: CurriculumViewRoute;
  homeLabel: string;
  locale: Locale;
  menuLabel: string;
  subjectLabel: string;
}) {
  return (
    <BreadcrumbHeader
      value={{
        homeLabel,
        items: [
          {
            href: getCurriculumIndexHref(locale),
            label: subjectLabel,
          },
          ...ancestors.map((ancestor) => ({
            href: `/${ancestor.publicPath}`,
            label: ancestor.title,
          })),
          { label: currentRoute.title },
        ],
        menuLabel,
        title: currentRoute.title,
      }}
    />
  );
}
