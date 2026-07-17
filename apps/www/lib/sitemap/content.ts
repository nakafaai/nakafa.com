import type { api } from "@repo/backend/convex/_generated/api";
import { compareSitemapPaths } from "@repo/backend/convex/contents/sitemap/spec";
import type { FunctionReturnType } from "convex/server";
import { Data, Effect } from "effect";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getContentSitemapPage>
>["routes"][number];

/** Two durable content rows claim the same canonical sitemap path. */
export class DuplicateSitemapContentRouteError extends Data.TaggedError(
  "DuplicateSitemapContentRouteError"
)<{
  readonly path: string;
}> {}

/** Builds exact sitemap routes and modification dates from one bounded page. */
export const buildSitemapContentPageRoutes = Effect.fn(
  "www.sitemap.buildContentPageRoutes"
)(function* (rows: readonly RuntimeContentRoute[]) {
  const paths = new Set<string>();
  const routes: { lastModified: number | undefined; path: string }[] = [];

  for (const row of rows) {
    const route = toSitemapContentRoute(row);

    if (!route) {
      continue;
    }

    if (paths.has(route.path)) {
      return yield* Effect.fail(
        new DuplicateSitemapContentRouteError({ path: route.path })
      );
    }

    paths.add(route.path);
    routes.push(route);
  }

  return routes.sort((left, right) =>
    compareSitemapPaths(left.path, right.path)
  );
});

/** Converts one durable content row to its exact sitemap route. */
function toSitemapContentRoute(row: RuntimeContentRoute) {
  if (row.section === "material" && row.kind !== "curriculum-lesson") {
    return;
  }

  return {
    lastModified: getRouteLastModified(row),
    path: routeToPath(row.route),
  };
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
