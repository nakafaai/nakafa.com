import type { Locale } from "@repo/contents/_types/content";
import {
  readIdentityLocaleKey,
  readLocalePathKey,
} from "@repo/contents/_types/route/learning/key";
import { normalizePublicPath } from "@repo/contents/_types/route/path";
import { readPracticeSourceSetParts } from "@repo/contents/_types/route/practice/identity";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
} from "@repo/contents/_types/route/practice/path";
import type { PublicRoute } from "@repo/contents/_types/route/schema";

type PublicPracticeSetRoute = Extract<PublicRoute, { kind: "exercise-set" }>;

/** Indexed projection Interface for virtual practice root and domain pages. */
export interface PracticePathIndex {
  /** Projects a localized practice domain page through the set material identity. */
  projectDomainPath(input: {
    currentLocale: Locale;
    path: string;
    targetLocale: Locale;
  }): string | undefined;
  /** Projects a localized practice root page through the assessment identity. */
  projectRootPath(input: {
    currentLocale: Locale;
    path: string;
    targetLocale: Locale;
  }): string | undefined;
}

/**
 * Builds virtual practice root/domain lookup maps from concrete set rows.
 *
 * Practice program roots and domains are renderable pages without their own
 * public-route rows. This index lets callers project those paths through the
 * set source identity without learning practice segment grammar.
 */
export function createPracticePathIndex(
  routes: readonly PublicRoute[]
): PracticePathIndex {
  const rootIdentityByPath = new Map<string, string>();
  const rootPathByIdentityAndLocale = new Map<string, string>();
  const domainIdentityByPath = new Map<string, string>();
  const domainPathByIdentityAndLocale = new Map<string, string>();

  for (const route of routes) {
    if (route.kind !== "exercise-set") {
      continue;
    }

    addPracticeSetRoute({
      domainIdentityByPath,
      domainPathByIdentityAndLocale,
      rootIdentityByPath,
      rootPathByIdentityAndLocale,
      route,
    });
  }

  return {
    projectDomainPath: ({ currentLocale, path, targetLocale }) =>
      projectVirtualPath({
        currentLocale,
        identityByPath: domainIdentityByPath,
        path,
        pathByIdentityAndLocale: domainPathByIdentityAndLocale,
        targetLocale,
      }),
    projectRootPath: ({ currentLocale, path, targetLocale }) =>
      projectVirtualPath({
        currentLocale,
        identityByPath: rootIdentityByPath,
        path,
        pathByIdentityAndLocale: rootPathByIdentityAndLocale,
        targetLocale,
      }),
  };
}

/** Adds exact and virtual practice root/domain lookup keys for one set route. */
function addPracticeSetRoute({
  domainIdentityByPath,
  domainPathByIdentityAndLocale,
  rootIdentityByPath,
  rootPathByIdentityAndLocale,
  route,
}: {
  domainIdentityByPath: Map<string, string>;
  domainPathByIdentityAndLocale: Map<string, string>;
  rootIdentityByPath: Map<string, string>;
  rootPathByIdentityAndLocale: Map<string, string>;
  route: PublicPracticeSetRoute;
}) {
  const source = readPracticeSourceSetParts(route.sourcePath);

  if (!source) {
    return;
  }

  const rootIdentity = [source.category, source.type].join(":");
  const domainIdentity = [rootIdentity, route.materialKey].join(":");
  const rootPath = readPublicPracticeAssessmentPath(route);
  const domainPath = readPublicPracticeDomainPath(route);

  rootIdentityByPath.set(
    readLocalePathKey(route.locale, rootPath),
    rootIdentity
  );
  rootPathByIdentityAndLocale.set(
    readIdentityLocaleKey(rootIdentity, route.locale),
    rootPath
  );
  domainIdentityByPath.set(
    readLocalePathKey(route.locale, domainPath),
    domainIdentity
  );
  domainPathByIdentityAndLocale.set(
    readIdentityLocaleKey(domainIdentity, route.locale),
    domainPath
  );
}

/** Projects a virtual root/domain path through its source-owned identity key. */
function projectVirtualPath({
  currentLocale,
  identityByPath,
  path,
  pathByIdentityAndLocale,
  targetLocale,
}: {
  currentLocale: Locale;
  identityByPath: ReadonlyMap<string, string>;
  path: string;
  pathByIdentityAndLocale: ReadonlyMap<string, string>;
  targetLocale: Locale;
}) {
  const identity = identityByPath.get(
    readLocalePathKey(currentLocale, normalizePublicPath(path))
  );

  if (!identity) {
    return;
  }

  return pathByIdentityAndLocale.get(
    readIdentityLocaleKey(identity, targetLocale)
  );
}
