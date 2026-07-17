import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("content route artifact runtime", () => {
  it("rejects invalid artifact page numbers", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contents.queries.runtime.getContentRouteArtifactPage, {
        locale: "id",
        page: -1,
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_ROUTE_ARTIFACT_PAGE_INVALID" },
    });
  });

  it("rejects an invalid committed generation pointer", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRouteCounts", {
        count: 0,
        locale: "id",
        section: "articles",
        syncedAt: 0,
      });
    });

    await expect(
      t.query(api.contents.queries.runtime.getContentRouteArtifactPage, {
        locale: "id",
        page: 0,
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RUNTIME_INTEGRITY_ERROR" },
    });
  });
});
