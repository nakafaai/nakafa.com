import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { readPublicPracticeSetMatch } from "@repo/contents/_types/route/practice/set";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";

/** Reads authored localized display copy for one projected practice set row. */
export function readPracticeSetDisplay(route: {
  locale: Locale;
  publicPath: string;
}) {
  const match = readPublicPracticeSetMatch({
    domains: MATERIAL_ROUTE_DOMAINS,
    locale: route.locale,
    materials: MATERIAL_SOURCES,
    publicPath: route.publicPath,
  });

  if (!match) {
    notFound();
  }

  return {
    groupDescription: match.group.translations[route.locale].description,
    groupTitle: match.group.translations[route.locale].title,
    setTitle: match.set.translations[route.locale].title,
  };
}
