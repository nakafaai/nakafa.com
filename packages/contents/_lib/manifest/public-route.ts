import {
  getCategoryPath as getArticleCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { Option } from "effect";

export type PublicContentRouteCheck =
  | { mode: "outside" }
  | { mode: "app" }
  | { mode: "missing" }
  | { mode: "exact"; route: string }
  | { mode: "article-category"; parentRoute: string };

/** Classifies one locale-free route for early public content existence checks. */
export function getPublicContentRouteCheck(
  route: string
): PublicContentRouteCheck {
  const parts = route.split("/").filter(Boolean);
  const [root] = parts;

  if (root === "articles") {
    return getArticleRouteCheck(parts);
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

/** Classifies Quran root and surah routes without reading Quran data. */
function getQuranRouteCheck(parts: readonly string[]): PublicContentRouteCheck {
  const [, surah] = parts;

  if (!surah) {
    return { mode: "app" };
  }

  return { mode: "exact", route: parts.join("/") };
}
