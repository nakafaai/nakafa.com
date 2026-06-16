import { compareExerciseSetSlugs } from "@repo/contents/_lib/assessment/slug";
import type { ExercisesMaterialList } from "@repo/contents/_types/assessment/material";
import type { Article } from "@repo/contents/_types/content";
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
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
  getRuntimeContentRouteParentPage,
  getRuntimeCurriculumOutline,
} from "@/lib/content/runtime";

type RuntimeContentRoute = Effect.Effect.Success<
  ReturnType<typeof getRuntimeContentRouteParentPage>
>["page"][number];
type RuntimeCurriculumOutlineTopic = Effect.Effect.Success<
  ReturnType<typeof getRuntimeCurriculumOutline>
>[number];

const articleSummaryPageLimit = 100;
const navigationGroupPageLimit = 100;
const navigationItemPageLimit = 100;
const navigationProbePageLimit = 1;
const navigationReadConcurrency = 8;
const trailingSlashPattern = /\/$/;

interface CurriculumGradeNavigationItem {
  category: SubjectCategory;
  grade: Grade;
  href: string;
}

interface CurriculumSubjectNavigationItem {
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
  const appPrefix = `assessment/${category}/${type}/`;
  const materialPrefix = `material/practice/assessment/${type}/`;
  const materialRows = yield* Effect.forEach(
    EXERCISES_MATERIALS,
    (material) =>
      readNavigationRouteParentPage({
        kind: "exercise-group",
        limit: navigationProbePageLimit,
        locale,
        order: "route",
        parentRoute: `${materialPrefix}${material}`,
        section: "material",
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
            href: `/${appPrefix}${material}`,
            label: material,
          },
        ]
      : []
  );
});

/** Reads curriculum grade cards from the generated curriculum outline. */
export const getRuntimeCurriculumGrades = Effect.fn(
  "www.contentNavigation.curriculumGrades"
)(function* (locale: Locale) {
  const categoryGradeRows = yield* Effect.forEach(
    SUBJECT_CATEGORIES,
    (category) =>
      Effect.forEach(
        GRADES,
        (grade) => hasCurriculumGrade(category, grade, locale),
        { concurrency: navigationReadConcurrency }
      ),
    { concurrency: 1 }
  );

  return categoryGradeRows
    .flat()
    .flatMap(({ category, grade, hasMaterials }) => {
      if (!hasMaterials) {
        return [];
      }

      return [
        {
          category,
          grade,
          href: `/${buildCurriculumGradePath(category, grade)}`,
        } satisfies CurriculumGradeNavigationItem,
      ];
    });
});

/** Reads available material lesson links from the generated curriculum outline. */
export const getRuntimeGradeSubjects = Effect.fn(
  "www.contentNavigation.curriculumSubjects"
)(function* (category: SubjectCategory, grade: Grade, locale: Locale) {
  const materialRows = yield* Effect.forEach(
    SUBJECT_MATERIALS,
    (material) =>
      getRuntimeCurriculumOutline({
        category,
        grade,
        locale,
        material,
      }).pipe(Effect.map((rows) => ({ material, rows }))),
    { concurrency: navigationReadConcurrency }
  );

  return materialRows.flatMap(({ material, rows }) => {
    if (rows.length === 0) {
      return [];
    }

    return [
      {
        href: `/${buildCurriculumSubjectPath(category, grade, material)}`,
        label: material,
      } satisfies CurriculumSubjectNavigationItem,
    ];
  });
});

/** Reads exercise material navigation groups from Convex route rows. */
export const getRuntimeExerciseMaterials = Effect.fn(
  "www.contentNavigation.exerciseMaterials"
)(function* (materialPath: string, locale: Locale) {
  const basePath = getAssessmentMaterialSourcePath(materialPath);
  const groups = yield* readNavigationRouteParentPage({
    kind: "exercise-group",
    limit: navigationGroupPageLimit,
    locale,
    order: "route",
    parentRoute: basePath,
    section: "material",
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
        section: "material",
      }),
    { concurrency: navigationReadConcurrency }
  );

  return buildExerciseMaterials([...validGroups, ...sets.flat()]);
});

/** Reads material lesson navigation groups from the authored Convex outline. */
export const getRuntimeCurriculumMaterials = Effect.fn(
  "www.contentNavigation.curriculumMaterials"
)(function* (materialPath: string, locale: Locale) {
  const basePath = cleanContentPath(materialPath);
  const parsedPath = parseCurriculumSubjectPath(basePath);

  if (!parsedPath) {
    return [];
  }

  const outline = yield* getRuntimeCurriculumOutline({
    ...parsedPath,
    locale,
  });

  return buildCurriculumMaterials(outline);
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

/** Finds the active curriculum topic and optional lesson item for one path. */
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

/** Checks whether one curriculum grade has any mapped material in Convex. */
function hasCurriculumGrade(
  category: SubjectCategory,
  grade: Grade,
  locale: Locale
) {
  return Effect.gen(function* () {
    const materialRows = yield* Effect.forEach(
      SUBJECT_MATERIALS,
      (material) =>
        getRuntimeCurriculumOutline({
          category,
          grade,
          locale,
          material,
        }),
      { concurrency: navigationReadConcurrency }
    );

    return {
      category,
      grade,
      hasMaterials: materialRows.some((rows) => rows.length > 0),
    };
  });
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

/** Builds curriculum navigation groups from the authored curriculum outline. */
function buildCurriculumMaterials(
  outline: readonly RuntimeCurriculumOutlineTopic[]
) {
  return outline.flatMap((topic) => {
    if (topic.sections.length === 0) {
      return [];
    }

    return [
      {
        description: topic.description,
        href: `/${topic.route}`,
        items: topic.sections.map((section) => ({
          href: `/${section.route}`,
          title: section.title,
        })),
        title: topic.title,
      },
    ];
  });
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

/** Translates public assessment routes into reusable practice material routes. */
function getAssessmentMaterialSourcePath(path: string) {
  const normalizedPath = cleanContentPath(path);
  const [root, , type, material, ...rest] = normalizedPath.split("/");

  if (root === "assessment" && type && material && rest.length === 0) {
    return `material/practice/assessment/${type}/${material}`;
  }

  return normalizedPath;
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

/** Builds one curriculum grade route path without touching filesystem content. */
function buildCurriculumGradePath(category: SubjectCategory, grade: Grade) {
  return `curriculum/${category}/${grade}`;
}

/** Builds one material lesson route path without touching filesystem content. */
function buildCurriculumSubjectPath(
  category: SubjectCategory,
  grade: Grade,
  material: Material
) {
  return `${buildCurriculumGradePath(category, grade)}/${material}`;
}

/** Parses and validates one material lesson route path for outline reads. */
function parseCurriculumSubjectPath(path: string) {
  const [root, rawCategory, rawGrade, rawMaterial, ...rest] =
    cleanContentPath(path).split("/");

  if (root !== "curriculum" || rest.length > 0) {
    return null;
  }

  const category = SUBJECT_CATEGORIES.find((item) => item === rawCategory);
  const grade = GRADES.find((item) => item === rawGrade);
  const material = SUBJECT_MATERIALS.find((item) => item === rawMaterial);

  if (!(category && grade && material)) {
    return null;
  }

  return { category, grade, material };
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
