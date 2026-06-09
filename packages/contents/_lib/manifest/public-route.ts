import {
  getCategoryPath as getArticleCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import {
  getMaterialPath as getExerciseMaterialPath,
  getExercisesPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { getGradePath, parseGrade } from "@repo/contents/_lib/subject/grade";
import {
  getMaterialPath as getSubjectMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/subject/route";
import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";
import { Option } from "effect";

export type PublicContentRouteCheck =
  | { mode: "outside" }
  | { mode: "app" }
  | { mode: "missing" }
  | { mode: "exact"; route: string }
  | { mode: "article-category"; parentRoute: string }
  | { mode: "exercise-type"; prefix: string }
  | { mode: "exercise-material"; parentRoute: string }
  | { mode: "subject-grade"; prefix: string }
  | { mode: "subject-material"; parentRoute: string };

/** Classifies one locale-free route for early public content existence checks. */
export function getPublicContentRouteCheck(
  route: string
): PublicContentRouteCheck {
  const parts = route.split("/").filter(Boolean);
  const [root] = parts;

  if (root === CONTENT_ROOT_VALUES.articles) {
    return getArticleRouteCheck(parts);
  }

  if (root === CONTENT_ROOT_VALUES.exercises) {
    return getExerciseRouteCheck(parts);
  }

  if (root === CONTENT_ROOT_VALUES.subject) {
    return getSubjectRouteCheck(parts);
  }

  if (root === "quran") {
    return getQuranRouteCheck(parts);
  }

  return { mode: "outside" };
}

/** Classifies article routes through the article category parser. */
function getArticleRouteCheck(
  parts: readonly string[]
): PublicContentRouteCheck {
  const [, rawCategory, articleSlug] = parts;

  if (!rawCategory) {
    return { mode: "app" };
  }

  const category = parseArticleCategory(rawCategory);

  if (Option.isNone(category)) {
    return { mode: "missing" };
  }

  if (!articleSlug) {
    return {
      mode: "article-category",
      parentRoute: getArticleCategoryPath(category.value).slice(1),
    };
  }

  return { mode: "exact", route: parts.join("/") };
}

/** Classifies exercise routes through exercise taxonomy parsers. */
function getExerciseRouteCheck(
  parts: readonly string[]
): PublicContentRouteCheck {
  const [, rawCategory, rawType, rawMaterial, ...slug] = parts;

  if (!rawCategory) {
    return { mode: "app" };
  }

  const category = parseExercisesCategory(rawCategory);

  if (Option.isNone(category) || !rawType) {
    return { mode: "missing" };
  }

  const type = parseExercisesType(rawType);

  if (Option.isNone(type)) {
    return { mode: "missing" };
  }

  if (!rawMaterial) {
    return {
      mode: "exercise-type",
      prefix: `${getExercisesPath(category.value, type.value).slice(1)}/`,
    };
  }

  const material = parseExercisesMaterial(rawMaterial);

  if (Option.isNone(material)) {
    return { mode: "missing" };
  }

  if (slug.length === 0) {
    return {
      mode: "exercise-material",
      parentRoute: getExerciseMaterialPath(
        category.value,
        type.value,
        material.value
      ).slice(1),
    };
  }

  return { mode: "exact", route: parts.join("/") };
}

/** Classifies subject routes through subject taxonomy parsers. */
function getSubjectRouteCheck(
  parts: readonly string[]
): PublicContentRouteCheck {
  const [, rawCategory, rawGrade, rawMaterial, ...slug] = parts;

  if (!rawCategory) {
    return { mode: "app" };
  }

  const category = parseSubjectCategory(rawCategory);

  if (Option.isNone(category) || !rawGrade) {
    return { mode: "missing" };
  }

  const grade = parseGrade(rawGrade);

  if (Option.isNone(grade)) {
    return { mode: "missing" };
  }

  if (!rawMaterial) {
    return {
      mode: "subject-grade",
      prefix: getGradePath(category.value, grade.value).slice(1),
    };
  }

  const material = parseMaterial(rawMaterial);

  if (Option.isNone(material)) {
    return { mode: "missing" };
  }

  if (slug.length === 0) {
    return {
      mode: "subject-material",
      parentRoute: getSubjectMaterialPath(
        category.value,
        grade.value,
        material.value
      ).slice(1),
    };
  }

  return { mode: "exact", route: parts.join("/") };
}

/** Classifies Quran root and surah routes without reading Quran data. */
function getQuranRouteCheck(parts: readonly string[]): PublicContentRouteCheck {
  const [, surah] = parts;

  if (!surah) {
    return { mode: "app" };
  }

  return { mode: "exact", route: parts.join("/") };
}
