import {
  getCategoryPath as getArticleCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { getSlugPath as getArticleSlugPath } from "@repo/contents/_lib/articles/slug";
import type { LocaleSlugEntry } from "@repo/contents/_lib/manifest/schema";
import type { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";
import { Effect, Option } from "effect";

/** Builds route paths from localized content entries. */
export function getContentRouteSets(
  _source: ContentRouteSource,
  localeSlugs: readonly LocaleSlugEntry[]
) {
  return Effect.sync(() => {
    const pages = new Set<string>();
    const redirects = new Map<string, string>();

    for (const { slugs } of localeSlugs) {
      for (const slug of slugs) {
        addArticleRoutes(pages, slug);
        addMaterialRoutes(pages, slug);
      }
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

/** Adds exact unified material pages from material MDX assets. */
function addMaterialRoutes(routes: Set<string>, slug: string) {
  const [root, ...segments] = slug.split("/");

  if (root !== CONTENT_ROOT_VALUES.material || segments.length === 0) {
    return;
  }

  routes.add(`/${slug}`);
}
