import { compareExerciseSetSlugs } from "@repo/contents/_lib/exercises/slug";
import type { Article } from "@repo/contents/_types/content";
import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import type { MaterialList } from "@repo/contents/_types/subject/material";
import type {
  ArticleCategory,
  ExercisesCategory,
  ExercisesType,
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";
import {
  EXERCISES_MATERIALS,
  GRADES,
  SUBJECT_CATEGORIES,
  SUBJECT_MATERIALS,
} from "@repo/contents/_types/taxonomy";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import {
  getRuntimeContentRouteKindPage,
  getRuntimeContentRouteParentPage,
} from "@/lib/content/runtime";

type RuntimeContentRoute = Effect.Effect.Success<
  ReturnType<typeof getRuntimeContentRouteParentPage>
>["page"][number];

const articleSummaryPageLimit = 100;
const navigationGroupPageLimit = 100;
const navigationItemPageLimit = 100;
const navigationProbePageLimit = 1;
const navigationReadConcurrency = 8;
const trailingSlashPattern = /\/$/;

interface SubjectGradeNavigationItem {
  category: SubjectCategory;
  grade: Grade;
  href: string;
}

interface SubjectMaterialNavigationItem {
  href: string;
  label: Material;
}

/** Reads article card summaries from Convex route catalog rows. */
export const getRuntimeArticleSummaries = Effect.fn(
  "www.contentNavigation.articleSummaries"
)(function* (category: ArticleCategory, locale: Locale) {
  const rows = yield* readNavigationRouteParentPage({
    kind: "article",
    limit: articleSummaryPageLimit,
    locale,
    order: "date-desc",
    parentRoute: `articles/${category}`,
    section: "articles",
  });
  const articles = new Map<string, Article>();

  for (const row of rows) {
    const slug = getDirectChildSegment(row.route, `articles/${category}/`);

    if (!(slug && row.date) || articles.has(slug)) {
      continue;
    }

    articles.set(slug, {
      date: new Date(row.date).toISOString(),
      description: row.description ?? "",
      official: row.official ?? false,
      slug,
      title: row.title,
    });
  }

  return Array.from(articles.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
});

/** Reads available exercise materials for one category/type from route rows. */
export const getRuntimeExerciseSubjects = Effect.fn(
  "www.contentNavigation.exerciseSubjects"
)(function* (category: ExercisesCategory, type: ExercisesType, locale: Locale) {
  const prefix = `exercises/${category}/${type}/`;
  const materialRows = yield* Effect.forEach(
    EXERCISES_MATERIALS,
    (material) =>
      readNavigationRouteParentPage({
        kind: "exercise-group",
        limit: navigationProbePageLimit,
        locale,
        order: "route",
        parentRoute: `${prefix}${material}`,
        section: "exercises",
      }).pipe(Effect.map((rows) => ({ material, rows }))),
    { concurrency: navigationReadConcurrency }
  );
  const materialRoutes = new Set(
    materialRows.flatMap(({ material, rows }) =>
      rows.length > 0 ? [material] : []
    )
  );

  return EXERCISES_MATERIALS.flatMap((material) =>
    materialRoutes.has(material)
      ? [
          {
            href: `/${prefix}${material}`,
            label: material,
          },
        ]
      : []
  );
});

/** Reads subject grade cards from Convex route catalog rows. */
export const getRuntimeSubjectGrades = Effect.fn(
  "www.contentNavigation.subjectGrades"
)(function* (locale: Locale) {
  const categoryGradeRows = yield* Effect.forEach(
    SUBJECT_CATEGORIES,
    (category) =>
      Effect.forEach(
        GRADES,
        (grade) =>
          readNavigationRouteKindPage({
            kind: "subject-topic",
            limit: navigationProbePageLimit,
            locale,
            prefix: buildSubjectGradePath(category, grade),
            section: "subject",
          }).pipe(Effect.map((rows) => ({ category, grade, rows }))),
        { concurrency: navigationReadConcurrency }
      ),
    { concurrency: 1 }
  );

  return categoryGradeRows.flat().flatMap(({ category, grade, rows }) => {
    if (rows.length === 0) {
      return [];
    }

    return [
      {
        category,
        grade,
        href: `/${buildSubjectGradePath(category, grade)}`,
      } satisfies SubjectGradeNavigationItem,
    ];
  });
});

/** Reads available subject material links from Convex route catalog rows. */
export const getRuntimeGradeSubjects = Effect.fn(
  "www.contentNavigation.gradeSubjects"
)(function* (category: SubjectCategory, grade: Grade, locale: Locale) {
  const materialRows = yield* Effect.forEach(
    SUBJECT_MATERIALS,
    (material) =>
      readNavigationRouteParentPage({
        kind: "subject-topic",
        limit: navigationProbePageLimit,
        locale,
        order: "route",
        parentRoute: buildSubjectMaterialPath(category, grade, material),
        section: "subject",
      }).pipe(Effect.map((rows) => ({ material, rows }))),
    { concurrency: navigationReadConcurrency }
  );

  return materialRows.flatMap(({ material, rows }) => {
    if (rows.length === 0) {
      return [];
    }

    return [
      {
        href: `/${buildSubjectMaterialPath(category, grade, material)}`,
        label: material,
      } satisfies SubjectMaterialNavigationItem,
    ];
  });
});

/** Reads exercise material navigation groups from Convex route rows. */
export const getRuntimeExerciseMaterials = Effect.fn(
  "www.contentNavigation.exerciseMaterials"
)(function* (materialPath: string, locale: Locale) {
  const basePath = cleanContentPath(materialPath);
  const groups = yield* readNavigationRouteParentPage({
    kind: "exercise-group",
    limit: navigationGroupPageLimit,
    locale,
    order: "route",
    parentRoute: basePath,
    section: "exercises",
  });
  const validGroups = uniqueRouteRows(
    groups.filter(
      (group) => getRelativeRouteParts(group.route, basePath).length > 0
    )
  );
  const sets = yield* Effect.forEach(
    validGroups,
    (group) =>
      readNavigationRouteParentPage({
        kind: "exercise-set",
        limit: navigationItemPageLimit,
        locale,
        order: "route",
        parentRoute: group.route,
        section: "exercises",
      }),
    { concurrency: navigationReadConcurrency }
  );

  return buildExerciseMaterials([...validGroups, ...sets.flat()]);
});

/** Reads subject material navigation groups from Convex route rows. */
export const getRuntimeSubjectMaterials = Effect.fn(
  "www.contentNavigation.subjectMaterials"
)(function* (materialPath: string, locale: Locale) {
  const basePath = cleanContentPath(materialPath);
  const topics = yield* readNavigationRouteParentPage({
    kind: "subject-topic",
    limit: navigationGroupPageLimit,
    locale,
    order: "route",
    parentRoute: basePath,
    section: "subject",
  });
  const validTopics = uniqueRouteRows(
    topics.filter(
      (topic) => getRelativeRouteParts(topic.route, basePath).length === 1
    )
  );
  const sections = yield* Effect.forEach(
    validTopics,
    (topic) =>
      readNavigationRouteParentPage({
        kind: "subject-section",
        limit: navigationItemPageLimit,
        locale,
        order: "route",
        parentRoute: topic.route,
        section: "subject",
      }),
    { concurrency: navigationReadConcurrency }
  );

  return buildSubjectMaterials([...validTopics, ...sections.flat()]);
});

/** Finds the active exercise group and optional set item for one path. */
export function getCurrentExerciseMaterial(
  path: string,
  materials: ExercisesMaterialList
) {
  const result = findCurrentMaterial(path, materials);

  return {
    currentMaterial: result.currentGroup,
    currentMaterialItem: result.currentItem,
  };
}

/** Finds the active subject chapter and optional lesson item for one path. */
export function getCurrentSubjectMaterial(
  path: string,
  materials: MaterialList
) {
  const result = findCurrentMaterial(path, materials);

  return {
    currentChapter: result.currentGroup,
    currentItem: result.currentItem,
  };
}

/** Reads one bounded parent-scoped route page for list/navigation surfaces. */
function readNavigationRouteParentPage(
  args: Omit<
    Parameters<typeof getRuntimeContentRouteParentPage>[0],
    "cursor" | "limit"
  > & { limit: number }
) {
  return getRuntimeContentRouteParentPage({
    ...args,
    cursor: null,
  }).pipe(Effect.map((page) => page.page));
}

/** Reads one bounded kind-prefix route page for finite taxonomy probes. */
function readNavigationRouteKindPage(
  args: Omit<
    Parameters<typeof getRuntimeContentRouteKindPage>[0],
    "cursor" | "limit"
  > & { limit: number }
) {
  return getRuntimeContentRouteKindPage({
    ...args,
    cursor: null,
  }).pipe(Effect.map((page) => page.page));
}

/** Builds exercise navigation groups from concrete set route rows. */
function buildExerciseMaterials(rows: readonly RuntimeContentRoute[]) {
  const groups = new Map<string, NavigationGroup>();

  for (const row of sortRouteRows(rows)) {
    if (row.kind !== "exercise-group") {
      continue;
    }

    groups.set(`/${row.route}`, {
      description: row.description,
      href: `/${row.route}`,
      items: [],
      title: row.title,
    });
  }

  for (const row of sortExerciseSetRouteRows(rows)) {
    if (row.kind !== "exercise-set") {
      continue;
    }

    const groupRoute = getParentRoute(row.route);
    const group = groups.get(`/${groupRoute}`);

    if (!group) {
      throw new Error(
        `Synced exercise set is missing group navigation row: ${row.route}`
      );
    }

    group.items.push({
      href: `/${row.route}`,
      title: row.title,
    });
  }

  return Array.from(groups.values()).filter((group) => group.items.length > 0);
}

/** Builds subject navigation groups from concrete lesson route rows. */
function buildSubjectMaterials(rows: readonly RuntimeContentRoute[]) {
  const groups = new Map<string, NavigationGroup>();

  for (const row of sortRouteRows(rows)) {
    if (row.kind !== "subject-topic") {
      continue;
    }

    groups.set(`/${row.route}`, {
      description: row.description,
      href: `/${row.route}`,
      items: [],
      title: row.title,
    });
  }

  for (const row of sortRouteRows(rows)) {
    if (row.kind !== "subject-section") {
      continue;
    }

    const groupRoute = getParentRoute(row.route);
    const group = groups.get(`/${groupRoute}`);

    if (!group) {
      throw new Error(
        `Synced subject section is missing topic navigation row: ${row.route}`
      );
    }

    group.items.push({
      href: `/${row.route}`,
      title: row.title,
    });
  }

  return Array.from(groups.values()).filter((group) => group.items.length > 0);
}

interface NavigationGroup {
  description?: string;
  href: string;
  items: { href: string; title: string }[];
  title: string;
}

/** Finds one material group and optional item by normalized href. */
function findCurrentMaterial<
  TMaterial extends { href: string; items: { href: string; title: string }[] },
>(path: string, materials: readonly TMaterial[]) {
  const normalizedPath = cleanSlug(path);

  for (const material of materials) {
    if (cleanSlug(material.href) === normalizedPath) {
      return {
        currentGroup: Option.some(material),
        currentItem: Option.none<TMaterial["items"][number]>(),
      };
    }

    for (const item of material.items) {
      if (cleanSlug(item.href) === normalizedPath) {
        return {
          currentGroup: Option.some(material),
          currentItem: Option.some(item),
        };
      }
    }
  }

  return {
    currentGroup: Option.none<TMaterial>(),
    currentItem: Option.none<TMaterial["items"][number]>(),
  };
}

/** Returns the direct child segment below one route prefix. */
function getDirectChildSegment(route: string, prefix: string) {
  const [segment] = getRelativeRouteParts(
    route,
    prefix.replace(trailingSlashPattern, "")
  );
  return segment;
}

/** Returns route segments below one normalized base path. */
function getRelativeRouteParts(route: string, basePath: string) {
  const normalizedRoute = cleanContentPath(route);
  const normalizedBase = cleanContentPath(basePath);

  if (!normalizedRoute.startsWith(`${normalizedBase}/`)) {
    return [];
  }

  return normalizedRoute.slice(normalizedBase.length + 1).split("/");
}

/** Removes leading slashes and duplicate separators from content paths. */
function cleanContentPath(path: string) {
  return cleanSlug(path.startsWith("/") ? path.slice(1) : path);
}

/** Returns the route above one concrete child route. */
function getParentRoute(route: string) {
  return cleanContentPath(route).split("/").slice(0, -1).join("/");
}

/** Sorts route rows by route for stable navigation output. */
function sortRouteRows(rows: readonly RuntimeContentRoute[]) {
  return [...rows].sort((a, b) => a.route.localeCompare(b.route));
}

/** Sorts exercise set rows by authored numeric set progression. */
function sortExerciseSetRouteRows(rows: readonly RuntimeContentRoute[]) {
  return [...rows].sort((a, b) => compareExerciseSetSlugs(a.route, b.route));
}

/** Builds one subject grade route path without touching filesystem content. */
function buildSubjectGradePath(category: SubjectCategory, grade: Grade) {
  return `subject/${category}/${grade}`;
}

/** Builds one subject material route path without touching filesystem content. */
function buildSubjectMaterialPath(
  category: SubjectCategory,
  grade: Grade,
  material: Material
) {
  return `${buildSubjectGradePath(category, grade)}/${material}`;
}

/** Keeps the first synced row for each route before reading children. */
function uniqueRouteRows(rows: readonly RuntimeContentRoute[]) {
  const byRoute = new Map<string, RuntimeContentRoute>();

  for (const row of rows) {
    if (byRoute.has(row.route)) {
      continue;
    }

    byRoute.set(row.route, row);
  }

  return Array.from(byRoute.values());
}
