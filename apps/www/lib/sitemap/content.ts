import type { api } from "@repo/backend/convex/_generated/api";
import { compareSitemapPaths } from "@repo/backend/convex/contents/sitemap/spec";
import type { FunctionReturnType } from "convex/server";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getContentSitemapPage>
>["routes"][number];

/** Builds sitemap routes and existing modification dates from catalog rows. */
export function buildSitemapContentPageRoutes(
  rows: readonly RuntimeContentRoute[]
) {
  const routes = new Map<string, number | undefined>();

  for (const row of rows) {
    addContentPageRoutes(routes, row);
  }

  return [...routes.entries()]
    .sort(([left], [right]) => compareSitemapPaths(left, right))
    .map(([path, lastModified]) => ({ lastModified, path }));
}

/** Adds the concrete route and supported parent index routes. */
function addContentPageRoutes(
  routes: Map<string, number | undefined>,
  row: RuntimeContentRoute
) {
  const lastModified = getRouteLastModified(row);

  if (row.section === "articles") {
    addArticleRoutes(routes, row.route, lastModified);
    return;
  }

  if (row.section === "material" && row.kind !== "curriculum-lesson") {
    return;
  }

  addRoute(routes, routeToPath(row.route), lastModified);
}

/** Adds article category and detail routes. */
function addArticleRoutes(
  routes: Map<string, number | undefined>,
  route: string,
  lastModified: number | undefined
) {
  const [, category] = route.split("/");
  addRoute(routes, `/articles/${category}`, lastModified);
  addRoute(routes, routeToPath(route), lastModified);
}

/** Keeps the newest known timestamp when parent routes are shared. */
function addRoute(
  routes: Map<string, number | undefined>,
  path: string,
  lastModified: number | undefined
) {
  const current = routes.get(path);

  if (current !== undefined && lastModified !== undefined) {
    routes.set(path, Math.max(current, lastModified));
    return;
  }

  if (!routes.has(path) || lastModified !== undefined) {
    routes.set(path, lastModified);
  }
}

/** Uses source dates first and stable sync dates for undated non-Quran rows. */
function getRouteLastModified(row: RuntimeContentRoute) {
  if (row.section === "quran") {
    return;
  }

  return row.date ?? row.syncedAt;
}

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}
