import {
  deleteContentRoutesBySourcePath,
  syncContentRoute,
} from "@repo/backend/convex/contents/helpers/routes/write";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("syncContentRoute", () => {
  it.each([
    ["quran/1", "quran"],
    ["material/lesson/chemistry/atomic-structure", "material/lesson/chemistry"],
    [
      "material/lesson/chemistry/atomic-structure/electron-configuration",
      "material/lesson/chemistry/atomic-structure",
    ],
    ["try-out/indonesia/snbt", "try-out/indonesia"],
    ["try-out/indonesia/snbt/2027", "try-out/indonesia/snbt"],
    ["try-out/indonesia/snbt/2027/set-1", "try-out/indonesia/snbt/2027"],
    [
      "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
      "try-out/indonesia/snbt/2027/set-1",
    ],
  ])("derives the parent route for %s", async (route, sourceParentPath) => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      async (ctx) => await syncContentRoute(ctx, contentRouteSource(route))
    );
    const row = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_sourcePath", (q) =>
            q.eq("locale", "id").eq("sourcePath", route)
          )
          .unique()
    );

    expect(row).toMatchObject({ sourceParentPath, sourcePath: route });
  });

  it("rejects a public route owned by another content identity", async () => {
    const t = convexTest(schema, convexModules);
    const route = "articles/politics/route-collision";
    const source = contentRouteSource(route);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", conflictingContentRoute(route));
    });

    await expect(
      t.mutation(async (ctx) => await syncContentRoute(ctx, source))
    ).rejects.toThrow("CONTENT_ROUTE_PUBLIC_PATH_COLLISION");
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .collect()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.content_id).toBe(`asset:conflict:${route}`);
  });

  it("replaces a renamed source only after its stale owner is deleted", async () => {
    const t = convexTest(schema, convexModules);
    const publicPath = "articles/politics/stable-public-path";
    const oldSourcePath = "articles/politics/old-source";
    const newSourcePath = "articles/politics/new-source";

    await t.mutation(async (ctx) => {
      await syncContentRoute(ctx, {
        ...contentRouteSource(oldSourcePath),
        publicPath,
      });
      await deleteContentRoutesBySourcePath(ctx, {
        locale: "id",
        sourcePath: oldSourcePath,
      });
      await syncContentRoute(ctx, {
        ...contentRouteSource(newSourcePath),
        publicPath,
      });
    });
    const rows = await t.query(async (ctx) =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_route", (q) =>
          q.eq("locale", "id").eq("route", publicPath)
        )
        .collect()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      content_id: contentRouteSource(newSourcePath).assetId,
      sourcePath: newSourcePath,
    });
  });

  it("rejects a source path owned by another content identity", async () => {
    const t = convexTest(schema, convexModules);
    const sourcePath = "articles/politics/source-collision";
    const existingRoute = "articles/politics/existing";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...conflictingContentRoute(existingRoute),
        sourcePath,
      });
    });

    await expect(
      t.mutation(async (ctx) =>
        syncContentRoute(ctx, contentRouteSource(sourcePath))
      )
    ).rejects.toThrow("CONTENT_ROUTE_SOURCE_COLLISION");
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_sourcePath", (q) =>
            q.eq("locale", "id").eq("sourcePath", sourcePath)
          )
          .collect()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.route).toBe(existingRoute);
  });
});

/** Builds one source row from the shared graph source-route projection spec. */
function contentRouteSource(route: string) {
  const projection = getSourceRouteProjectionForRoute(route, "id");

  if (!projection) {
    throw new Error(`Expected graph source-route projection for ${route}.`);
  }

  const graph = createLearningGraphIdentityFromRoute({ locale: "id", route });

  if (!graph) {
    throw new Error(`Expected graph identity fixture for ${route}.`);
  }

  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `${route}:hash`,
    date: NOW,
    kind: projection.kind,
    locale: "id" as const,
    markdown: true,
    publicPath: route,
    section: projection.sourceRoot,
    sourcePath: route,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds one persisted row with a different graph identity. */
function conflictingContentRoute(route: string) {
  const source = contentRouteSource(route);

  return {
    authors: source.authors,
    alignmentId: `alignment:conflict:${route}`,
    assetId: `asset:conflict:${route}`,
    conceptId: `concept:conflict:${route}`,
    contentHash: source.contentHash,
    content_id: `asset:conflict:${route}`,
    date: source.date,
    kind: source.kind,
    learningObjectId: `lo:conflict:${route}`,
    lensId: `lens:conflict:${route}`,
    locale: source.locale,
    markdown: source.markdown,
    route,
    section: source.section,
    sourcePath: source.sourcePath,
    syncedAt: source.syncedAt,
    title: source.title,
  };
}
