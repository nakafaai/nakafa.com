import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { contentRoutesHandler } from "@repo/backend/convex/triggers/contents/routes";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const MATERIAL_ROUTE_KIND = "curriculum-lesson";
const MATERIAL_SECTION = "material";
type ContentRoute = WithoutSystemFields<Doc<"contentRoutes">>;

/** Creates one concrete route row for direct trigger branch coverage. */
function makeContentRoute(): ContentRoute {
  const projection = makeMaterialProjection("en", 1);
  return {
    ...projection.graph,
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    contentHash: "content-route-trigger",
    content_id: projection.graph.assetId,
    kind: MATERIAL_ROUTE_KIND,
    locale: projection.locale,
    markdown: true,
    parentRoute: projection.parentPath,
    route: projection.publicPath,
    section: MATERIAL_SECTION,
    sourcePath: projection.contentKey,
    syncedAt: 1,
    title: projection.metadata.title,
  };
}

describe("triggers/contents/routes", () => {
  it("ignores deletions and identity-stable updates", async () => {
    const target = convexTest(schema, convexModules);
    const route = await target.mutation(async (ctx) => {
      const id = await ctx.db.insert("contentRoutes", makeContentRoute());
      const row = await ctx.db.get("contentRoutes", id);
      if (!row) {
        throw new Error("Expected one concrete route fixture.");
      }
      return row;
    });

    await expect(
      target.mutation((ctx) =>
        contentRoutesHandler(ctx, {
          id: route._id,
          newDoc: null,
          oldDoc: route,
          operation: "delete",
        })
      )
    ).resolves.toBeNull();
    await expect(
      target.mutation((ctx) =>
        contentRoutesHandler(ctx, {
          id: route._id,
          newDoc: route,
          oldDoc: route,
          operation: "update",
        })
      )
    ).resolves.toBeNull();
  });

  it("rolls back source sync that collides with an exact material", async () => {
    const target = convexTest(schema, convexModules);
    const publicPath = PublicPathSchema.make(
      "articles/politics/exact-material-collision"
    );
    const selected = MaterialLessonProjectionSchema.make({
      ...makeMaterialProjection("en", 1),
      parentPath: PublicPathSchema.make("articles/politics"),
      publicPath,
    });
    await activateMaterialCatalog(target, [selected]);
    await selectExactMaterial(target, selected);
    await target.mutation((ctx) =>
      ctx.db.insert("authors", { name: "Ada", username: "ada" })
    );

    await expect(
      target.mutation(
        internal.contentSync.mutations.articles.bulkSyncArticles,
        {
          articles: [
            {
              articleSlug: "exact-material-collision",
              authors: [{ name: "Ada" }],
              body: "Source collision body",
              category: "politics",
              contentHash: "source-collision",
              date: 1,
              description: "Source route collision fixture.",
              locale: "en",
              official: true,
              references: [],
              slug: publicPath,
              title: "Source Collision",
            },
          ],
        }
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });

    const rows = await target.query(async (ctx) => ({
      articles: await ctx.db.query("articleContents").take(1),
      routes: await ctx.db.query("contentRoutes").take(1),
      search: await ctx.db.query("contentSearch").take(1),
    }));
    expect(rows).toEqual({ articles: [], routes: [], search: [] });
  });
});
