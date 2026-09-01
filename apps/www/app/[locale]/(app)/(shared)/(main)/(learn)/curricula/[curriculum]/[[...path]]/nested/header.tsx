import type { Locale } from "next-intl";
import type { CurriculumViewRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

/** Renders a nested curriculum chooser with breadcrumb context only. */
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
