import {
  getCategoryPath as getArticleCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { getSlugPath as getArticleSlugPath } from "@repo/contents/_lib/articles/slug";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  getExerciseQuestionNumbers,
  getExerciseSetPaths,
} from "@repo/contents/_lib/exercises/collection";
import {
  getMaterialPath as getExerciseMaterialPath,
  getExercisesPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import {
  getSlugPath as getExerciseSlugPath,
  hasInvalidTryOutYearSlug,
  isYearlessTryOutCollectionSlug,
} from "@repo/contents/_lib/exercises/slug";
import { getFolderChildNamesSync } from "@repo/contents/_lib/fs";
import { getAllSurah } from "@repo/contents/_lib/quran";
import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { getGradePath, parseGrade } from "@repo/contents/_lib/subject/grade";
import {
  getMaterialPath as getSubjectMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/subject/route";
import { getSlugPath as getSubjectSlugPath } from "@repo/contents/_lib/subject/slug";
import { ContentRootSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";

const contentRoots = ContentRootSchema.enum;
const quranRoot = "quran";
const subjectRootRoute = `/${contentRoots.subject}`;
const quranRootRoute = `/${quranRoot}`;

/** Static top-level routes that should always be present in the sitemap. */
export const baseRoutes = [
  "/",
  "/search",
  "/contributor",
  quranRootRoute,
  subjectRootRoute,
  "/about",
  "/terms-of-service",
  "/privacy-policy",
  "/security-policy",
];

/** Top-level educational pages handled outside the content route scan. */
const publicContentBaseRoutes = [subjectRootRoute, quranRootRoute];

/** Builds relative Quran routes from validated Quran data. */
export function getQuranRoutes() {
  return getAllSurah().map((surah) => `/${quranRoot}/${surah.number}`);
}

/** Builds public educational routes that are backed by content or Quran data. */
export function getPublicContentRoutes() {
  return [...getContentRouteSets().pages, ...getQuranRoutes()];
}

/** Builds public educational request routes, including redirect-only legacy URLs. */
export function getPublicContentRequestRoutes() {
  const { pages, redirects } = getContentRouteSets();

  return [
    ...publicContentBaseRoutes,
    ...pages,
    ...redirects.keys(),
    ...getQuranRoutes(),
  ];
}

/** Builds redirect-only public content routes with their canonical targets. */
export function getPublicContentRedirects() {
  return Array.from(getContentRouteSets().redirects);
}

/** Builds the deduplicated route list used by `/sitemap.xml` and indexing scripts. */
export function getSitemapRoutes() {
  const allRoutes = new Set([...baseRoutes, ...getPublicContentRoutes()]);

  return Array.from(allRoutes);
}

/** Returns route roots that are backed by educational content pages. */
export function getPublicContentRouteRoots() {
  const roots = new Set<string>();

  for (const route of getPublicContentRequestRoutes()) {
    const [root] = route.split("/").filter(Boolean);
    roots.add(`/${root}`);
  }

  return Array.from(roots);
}

/** Builds route paths from localized content entries instead of raw folders. */
function getContentRouteSets() {
  const pages = new Set<string>();
  const redirects = new Map<string, string>();

  addExerciseListingRoutes(pages);
  addSubjectListingRoutes(pages);

  for (const locale of routing.locales) {
    const slugs = getMDXSlugsForLocale(locale);

    for (const slug of slugs) {
      addArticleRoutes(pages, slug);
      addSubjectRoutes(pages, redirects, slug);
    }

    addExerciseRoutes(pages, locale, slugs);
  }

  return { pages, redirects };
}

/** Adds exercises type and material pages backed by folder-level listing data. */
function addExerciseListingRoutes(routes: Set<string>) {
  for (const rawCategory of getContentFolderNames(contentRoots.exercises)) {
    const category = parseExercisesCategory(rawCategory);

    if (!category) {
      continue;
    }

    for (const rawType of getContentFolderNames(
      `${contentRoots.exercises}/${category}`
    )) {
      const type = parseExercisesType(rawType);

      if (!type) {
        continue;
      }

      routes.add(getExercisesPath(category, type));

      for (const rawMaterial of getContentFolderNames(
        `${contentRoots.exercises}/${category}/${type}`
      )) {
        const material = parseExercisesMaterial(rawMaterial);

        if (material) {
          routes.add(getExerciseMaterialPath(category, type, material));
        }
      }
    }
  }
}

/** Adds subject grade and material pages backed by folder-level listing data. */
function addSubjectListingRoutes(routes: Set<string>) {
  for (const rawCategory of getContentFolderNames(contentRoots.subject)) {
    const category = parseSubjectCategory(rawCategory);

    if (!category) {
      continue;
    }

    for (const rawGrade of getContentFolderNames(
      `${contentRoots.subject}/${category}`
    )) {
      const grade = parseGrade(rawGrade);

      if (!grade) {
        continue;
      }

      routes.add(getGradePath(category, grade));

      for (const rawMaterial of getContentFolderNames(
        `${contentRoots.subject}/${category}/${grade}`
      )) {
        const material = parseMaterial(rawMaterial);

        if (material) {
          routes.add(getSubjectMaterialPath(category, grade, material));
        }
      }
    }
  }
}

/** Reads content child folders with missing folders treated as empty route groups. */
function getContentFolderNames(folder: string) {
  return getFolderChildNamesSync(folder);
}

/** Adds article category and detail pages backed by article MDX content. */
function addArticleRoutes(routes: Set<string>, slug: string) {
  const [root, rawCategory, articleSlug] = slug.split("/");

  if (root !== contentRoots.articles || !(rawCategory && articleSlug)) {
    return;
  }

  const category = parseArticleCategory(rawCategory);

  if (!category) {
    return;
  }

  routes.add(getArticleCategoryPath(category));
  routes.add(getArticleSlugPath(category, articleSlug));
}

/** Adds subject grade, material, and lesson pages backed by subject MDX content. */
function addSubjectRoutes(
  routes: Set<string>,
  redirects: Map<string, string>,
  slug: string
) {
  const [
    root,
    rawCategory = "",
    rawGrade = "",
    rawMaterial = "",
    ...lessonSlug
  ] = slug.split("/");

  if (root !== contentRoots.subject || lessonSlug.length === 0) {
    return;
  }

  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (!(category && grade && material)) {
    return;
  }

  routes.add(getGradePath(category, grade));
  const materialRoute = getSubjectMaterialPath(category, grade, material);
  const chapterRoute = getSubjectSlugPath(
    category,
    grade,
    material,
    lessonSlug.slice(0, 1)
  );

  routes.add(materialRoute);
  redirects.set(chapterRoute, materialRoute);

  if (isSubjectChapterRedirectSlug(lessonSlug)) {
    return;
  }

  routes.add(getSubjectSlugPath(category, grade, material, lessonSlug));
}

/** Matches subject chapter redirects handled by the catch-all subject page. */
function isSubjectChapterRedirectSlug(slug: string[]) {
  const [chapter, lesson] = slug;
  return chapter !== undefined && lesson === undefined;
}

/** Adds exercises listing, group, set, and question pages from exercise entries. */
function addExerciseRoutes(
  routes: Set<string>,
  locale: Locale,
  slugs: readonly string[]
) {
  for (const setPath of getExerciseSetPaths(locale)) {
    const [root, rawCategory = "", rawType = "", rawMaterial = "", ...setSlug] =
      setPath.split("/");

    if (root !== contentRoots.exercises || setSlug.length === 0) {
      continue;
    }

    const category = parseExercisesCategory(rawCategory);
    const type = parseExercisesType(rawType);
    const material = parseExercisesMaterial(rawMaterial);

    if (!(category && type && material) || isLegacyExerciseSlug(setSlug)) {
      continue;
    }

    routes.add(getExercisesPath(category, type));
    routes.add(getExerciseMaterialPath(category, type, material));

    for (const parentSlug of getParentSlugs(setSlug)) {
      if (!isLegacyExerciseSlug(parentSlug)) {
        routes.add(getExerciseSlugPath(category, type, material, parentSlug));
      }
    }

    routes.add(getExerciseSlugPath(category, type, material, setSlug));

    for (const number of getExerciseQuestionNumbers(slugs, setPath)) {
      routes.add(
        getExerciseSlugPath(category, type, material, [...setSlug, number])
      );
    }
  }
}

/** Returns every non-empty parent slug from the current nested slug. */
function getParentSlugs(slug: string[]) {
  return slug.slice(0, -1).map((_, index) => slug.slice(0, index + 1));
}

/** Keeps migrated yearless try-out paths out of canonical sitemap routes. */
function isLegacyExerciseSlug(slug: string[]) {
  return isYearlessTryOutCollectionSlug(slug) || hasInvalidTryOutYearSlug(slug);
}
