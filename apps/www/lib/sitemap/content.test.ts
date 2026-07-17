// @vitest-environment node

import type { api } from "@repo/backend/convex/_generated/api";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import type { FunctionReturnType } from "convex/server";
import { describe, expect, it } from "vitest";
import { buildSitemapContentPageRoutes } from "@/lib/sitemap/content";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getContentSitemapPage>
>["routes"][number];

describe("sitemap content routes", () => {
  it("derives rendered paths and preserves existing modification dates", () => {
    const routes = buildSitemapContentPageRoutes([
      routeRow("articles/politics/article", "articles", 30),
      routeRow(
        "subjects/chemistry/topic/lesson",
        "material",
        20,
        "material/lesson/chemistry/topic/lesson"
      ),
      routeRow(
        "subjects/chemistry/topic",
        "material",
        10,
        "material/topic/chemistry/topic",
        "curriculum-topic"
      ),
      routeRow("quran/1", "quran", 40),
    ]);

    expect(routes).toEqual([
      { lastModified: 30, path: "/articles/politics" },
      { lastModified: 30, path: "/articles/politics/article" },
      { lastModified: undefined, path: "/quran/1" },
      {
        lastModified: 20,
        path: "/subjects/chemistry/topic/lesson",
      },
    ]);
  });

  it("deduplicates durable paths and keeps the newest known date", () => {
    const first = routeRow(
      "subjects/chemistry/topic/lesson",
      "material",
      10,
      "material/lesson/chemistry/topic/lesson"
    );
    const second = routeRow(
      "subjects/chemistry/topic/lesson",
      "material",
      20,
      "material/lesson/chemistry/topic/alternate"
    );

    expect(buildSitemapContentPageRoutes([first, second])).toEqual([
      {
        lastModified: 20,
        path: "/subjects/chemistry/topic/lesson",
      },
    ]);
  });

  it("uses sync dates for undated content and deduplicates undated Quran paths", () => {
    const undated = {
      ...routeRow("try-out/indonesia/snbt/2027/set-1", "tryout", 50),
      date: undefined,
    };
    const quran = routeRow("quran/1", "quran", 40);

    expect(buildSitemapContentPageRoutes([undated, quran, quran])).toEqual([
      { lastModified: undefined, path: "/quran/1" },
      {
        lastModified: 50,
        path: "/try-out/indonesia/snbt/2027/set-1",
      },
    ]);
  });
});

/** Builds one graph-backed sitemap content route. */
function routeRow(
  route: string,
  section: SourceRegistryRoot,
  date: number,
  sourcePath = route,
  kindOverride?: RuntimeContentRoute["kind"]
): RuntimeContentRoute {
  const projection = getSourceRouteProjectionForRoute(sourcePath, "en");
  const kind = kindOverride ?? projection?.kind;

  if (!kind) {
    throw new Error(`Expected graph metadata for ${sourcePath}.`);
  }

  return {
    date,
    kind,
    route,
    section,
    syncedAt: date,
  };
}
