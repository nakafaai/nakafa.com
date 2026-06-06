import {
  getCategoryPath as getArticleCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { getSlugPath as getArticleSlugPath } from "@repo/contents/_lib/articles/slug";
import {
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
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
import type { LocaleSlugEntry } from "@repo/contents/_lib/manifest/schema";
import {
  type ContentRouteSource,
  getFolderNamesOrEmpty,
} from "@repo/contents/_lib/manifest/source";
import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { getGradePath, parseGrade } from "@repo/contents/_lib/subject/grade";
import {
  getMaterialPath as getSubjectMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/subject/route";
import { getSlugPath as getSubjectSlugPath } from "@repo/contents/_lib/subject/slug";
import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";
import { Effect, Option } from "effect";

/** Builds route paths from localized content entries and listing folders. */
export function getContentRouteSets(
  source: ContentRouteSource,
  localeSlugs: readonly LocaleSlugEntry[]
) {
  return Effect.gen(function* () {
    const pages = new Set<string>();
    const redirects = new Map<string, string>();

    yield* addExerciseListingRoutes(source, pages);
    yield* addSubjectListingRoutes(source, pages);

    for (const { slugs } of localeSlugs) {
      for (const slug of slugs) {
        addArticleRoutes(pages, slug);
        addSubjectRoutes(pages, redirects, slug);
      }

      addExerciseRoutes(pages, slugs);
    }

    return { pages: Array.from(pages), redirects };
  });
}

/** Returns route roots backed by public educational content. */
export function getRouteRoots(routes: readonly string[]) {
  const roots = new Set<string>();

  for (const route of routes) {
    const [root] = route.split("/").filter(Boolean);

    if (root) {
      roots.add(`/${root}`);
    }
  }

  return Array.from(roots);
}

/** Adds exercises type and material pages backed by folder-level listings. */
function addExerciseListingRoutes(
  source: ContentRouteSource,
  routes: Set<string>
) {
  return Effect.gen(function* () {
    const categories = yield* getFolderNamesOrEmpty(
      source,
      CONTENT_ROOT_VALUES.exercises
    );

    for (const rawCategory of categories) {
      const category = parseExercisesCategory(rawCategory);

      if (Option.isNone(category)) {
        continue;
      }

      const types = yield* getFolderNamesOrEmpty(
        source,
        `${CONTENT_ROOT_VALUES.exercises}/${category.value}`
      );

      for (const rawType of types) {
        const type = parseExercisesType(rawType);

        if (Option.isNone(type)) {
          continue;
        }

        routes.add(getExercisesPath(category.value, type.value));

        const materials = yield* getFolderNamesOrEmpty(
          source,
          `${CONTENT_ROOT_VALUES.exercises}/${category.value}/${type.value}`
        );

        for (const rawMaterial of materials) {
          const material = parseExercisesMaterial(rawMaterial);

          if (Option.isSome(material)) {
            routes.add(
              getExerciseMaterialPath(
                category.value,
                type.value,
                material.value
              )
            );
          }
        }
      }
    }
  });
}

/** Adds subject grade and material pages backed by folder-level listings. */
function addSubjectListingRoutes(
  source: ContentRouteSource,
  routes: Set<string>
) {
  return Effect.gen(function* () {
    const categories = yield* getFolderNamesOrEmpty(
      source,
      CONTENT_ROOT_VALUES.subject
    );

    for (const rawCategory of categories) {
      const category = parseSubjectCategory(rawCategory);

      if (Option.isNone(category)) {
        continue;
      }

      const grades = yield* getFolderNamesOrEmpty(
        source,
        `${CONTENT_ROOT_VALUES.subject}/${category.value}`
      );

      for (const rawGrade of grades) {
        const grade = parseGrade(rawGrade);

        if (Option.isNone(grade)) {
          continue;
        }

        routes.add(getGradePath(category.value, grade.value));

        const materials = yield* getFolderNamesOrEmpty(
          source,
          `${CONTENT_ROOT_VALUES.subject}/${category.value}/${grade.value}`
        );

        for (const rawMaterial of materials) {
          const material = parseMaterial(rawMaterial);

          if (Option.isSome(material)) {
            routes.add(
              getSubjectMaterialPath(
                category.value,
                grade.value,
                material.value
              )
            );
          }
        }
      }
    }
  });
}

/** Adds article category and detail pages backed by article MDX content. */
function addArticleRoutes(routes: Set<string>, slug: string) {
  const [root, rawCategory, articleSlug] = slug.split("/");

  if (root !== CONTENT_ROOT_VALUES.articles || !(rawCategory && articleSlug)) {
    return;
  }

  const category = parseArticleCategory(rawCategory);

  if (Option.isNone(category)) {
    return;
  }

  routes.add(getArticleCategoryPath(category.value));
  routes.add(getArticleSlugPath(category.value, articleSlug));
}

/** Adds subject grade, material, and lesson pages backed by MDX content. */
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

  if (root !== CONTENT_ROOT_VALUES.subject || lessonSlug.length === 0) {
    return;
  }

  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (
    Option.isNone(category) ||
    Option.isNone(grade) ||
    Option.isNone(material)
  ) {
    return;
  }

  routes.add(getGradePath(category.value, grade.value));
  const materialRoute = getSubjectMaterialPath(
    category.value,
    grade.value,
    material.value
  );
  const chapterRoute = getSubjectSlugPath(
    category.value,
    grade.value,
    material.value,
    lessonSlug.slice(0, 1)
  );

  routes.add(materialRoute);
  redirects.set(chapterRoute, materialRoute);

  if (isSubjectChapterRedirectSlug(lessonSlug)) {
    return;
  }

  routes.add(
    getSubjectSlugPath(category.value, grade.value, material.value, lessonSlug)
  );
}

/** Adds exercises listing, group, set, and question pages from entries. */
function addExerciseRoutes(routes: Set<string>, slugs: readonly string[]) {
  for (const setPath of getExerciseSetPathsFromSlugs(slugs)) {
    const [root, rawCategory = "", rawType = "", rawMaterial = "", ...setSlug] =
      setPath.split("/");

    if (root !== CONTENT_ROOT_VALUES.exercises || setSlug.length === 0) {
      continue;
    }

    const category = parseExercisesCategory(rawCategory);
    const type = parseExercisesType(rawType);
    const material = parseExercisesMaterial(rawMaterial);

    if (
      Option.isNone(category) ||
      Option.isNone(type) ||
      Option.isNone(material) ||
      isLegacyExerciseSlug(setSlug)
    ) {
      continue;
    }

    routes.add(getExercisesPath(category.value, type.value));
    routes.add(
      getExerciseMaterialPath(category.value, type.value, material.value)
    );

    for (const parentSlug of getParentSlugs(setSlug)) {
      if (!isLegacyExerciseSlug(parentSlug)) {
        routes.add(
          getExerciseSlugPath(
            category.value,
            type.value,
            material.value,
            parentSlug
          )
        );
      }
    }

    routes.add(
      getExerciseSlugPath(category.value, type.value, material.value, setSlug)
    );

    for (const number of getExerciseQuestionNumbers(slugs, setPath)) {
      routes.add(
        getExerciseSlugPath(category.value, type.value, material.value, [
          ...setSlug,
          number,
        ])
      );
    }
  }
}

/** Returns whether one subject slug is a redirect-only chapter route. */
function isSubjectChapterRedirectSlug(slug: string[]) {
  return slug.length === 1;
}

/** Returns every non-empty parent slug from the current nested slug. */
function getParentSlugs(slug: string[]) {
  return slug.slice(0, -1).map((_, index) => slug.slice(0, index + 1));
}

/** Returns whether one exercise slug belongs to a legacy redirect path. */
function isLegacyExerciseSlug(slug: string[]) {
  return isYearlessTryOutCollectionSlug(slug) || hasInvalidTryOutYearSlug(slug);
}
