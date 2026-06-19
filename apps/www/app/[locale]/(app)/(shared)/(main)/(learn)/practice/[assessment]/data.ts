import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
} from "@repo/contents/_types/route/practice/path";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  type PracticeSetRoute,
  readPracticeRoutes,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/routes";
import { readExerciseSetSourceParts } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type PracticeProgramParams = Promise<{ assessment: string; locale: string }>;

export interface PracticeProgramDomain {
  href: string;
  sourceMaterial: ReturnType<typeof readExerciseSetSourceParts>["material"];
}

export interface PracticeProgramData {
  alternatePaths: Array<{ locale: Locale; publicPath: string }>;
  assessmentPath: string;
  domains: PracticeProgramDomain[];
  locale: Locale;
  publicPath: string;
  sourceType: ReturnType<typeof readExerciseSetSourceParts>["type"];
}

/** Builds static params for canonical practice program roots such as `/practice/snbt`. */
export function listPracticeProgramStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;
  const paramsByPath = new Map<string, { assessment: string }>();

  for (const route of readPracticeRoutes()) {
    if (locale && route.locale !== locale) {
      continue;
    }

    const assessment = readPathWithoutNamespace(
      readPublicPracticeAssessmentPath(route)
    );

    paramsByPath.set(`${route.locale}:${assessment}`, { assessment });
  }

  return Array.from(paramsByPath.values());
}

/** Resolves one canonical practice program root from projected set rows. */
export async function getPracticeProgramData(
  params: PracticeProgramParams
): Promise<PracticeProgramData> {
  const { locale: rawLocale, assessment } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routes = readPracticeRoutes();
  const programRoutes = routes.filter(
    (route) =>
      route.locale === locale &&
      readPathWithoutNamespace(readPublicPracticeAssessmentPath(route)) ===
        assessment
  );

  if (!hasProgramRoutes(programRoutes)) {
    notFound();
  }

  const firstRoute = programRoutes[0];
  const sourceParts = readExerciseSetSourceParts(firstRoute.sourcePath);
  const publicPath = readPublicPracticeAssessmentPath(firstRoute);

  return {
    alternatePaths: readPracticeProgramAlternatePaths(sourceParts.type, routes),
    assessmentPath: `/${locale}/${publicPath}`,
    domains: readPracticeProgramDomains(locale, programRoutes),
    locale,
    publicPath,
    sourceType: sourceParts.type,
  };
}

/** Reads one title-only domain row for each practice domain under a program root. */
function readPracticeProgramDomains(
  locale: Locale,
  routes: readonly PracticeSetRoute[]
) {
  const domainsByPath = new Map<string, PracticeProgramDomain>();

  for (const route of routes) {
    const domainPath = readPublicPracticeDomainPath(route);

    if (domainsByPath.has(domainPath)) {
      continue;
    }

    const sourceParts = readExerciseSetSourceParts(route.sourcePath);

    domainsByPath.set(domainPath, {
      href: `/${locale}/${domainPath}`,
      sourceMaterial: sourceParts.material,
    });
  }

  return Array.from(domainsByPath.values());
}

/** Reads localized practice program root alternates from projected sibling rows. */
function readPracticeProgramAlternatePaths(
  sourceType: PracticeProgramData["sourceType"],
  routes: readonly PracticeSetRoute[]
) {
  const paths: Array<{ locale: Locale; publicPath: string }> = [];
  const seen = new Set<string>();

  for (const route of routes) {
    const sourceParts = readExerciseSetSourceParts(route.sourcePath);

    if (sourceParts.type !== sourceType) {
      continue;
    }

    const publicPath = readPublicPracticeAssessmentPath(route);
    const key = `${route.locale}:${publicPath}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    paths.push({ locale: route.locale, publicPath });
  }

  return paths;
}

/** Narrows projected set rows to the non-empty practice program input. */
function hasProgramRoutes(
  routes: readonly PracticeSetRoute[]
): routes is readonly [PracticeSetRoute, ...PracticeSetRoute[]] {
  return routes.length > 0;
}
