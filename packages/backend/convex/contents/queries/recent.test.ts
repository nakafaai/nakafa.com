import { describe, expect, it } from "@effect/vitest";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  FUNCTION_MATERIAL,
  makeMaterialProjection,
} from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/** Inserts one deliberately stale copy of a signed material recent row. */
async function insertMaterialRecent(
  ctx: MutationCtx,
  projection: MaterialLessonProjection,
  userId: Id<"users">,
  lastViewedAt: number
) {
  await ctx.db.insert("userLearningRecents", {
    ...projection.graph,
    ...canonicalContext,
    content_id: projection.graph.assetId,
    description: "Stale copied description",
    lastViewedAt,
    locale: "en",
    materialDomain: "biology",
    route: projection.publicPath,
    section: "material",
    sourcePath: "stale/copied/source",
    title: "Stale copied title",
    userId,
  });
}

describe("contents/queries/recent", () => {
  it("hydrates a recent card from the current signed material", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [FUNCTION_MATERIAL]);
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-current-material",
      });
      await insertMaterialRecent(ctx, FUNCTION_MATERIAL, viewer.userId, NOW);
      return viewer;
    });

    const results = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: FUNCTION_MATERIAL.graph.assetId,
        content_id: FUNCTION_MATERIAL.graph.assetId,
        description: FUNCTION_MATERIAL.metadata.description,
        href: `/${FUNCTION_MATERIAL.publicPath}`,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        route: FUNCTION_MATERIAL.publicPath,
        title: FUNCTION_MATERIAL.metadata.title,
        url: `https://nakafa.com/en/${FUNCTION_MATERIAL.publicPath}`,
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
  });

  it("skips missing signed targets and fills the requested result limit", async () => {
    const current = makeMaterialProjection("en", 1, 10);
    const missingFirst = makeMaterialProjection("en", 2, 11);
    const missingSecond = makeMaterialProjection("en", 3, 12);
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [current]);
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-filtered-targets",
      });
      await insertMaterialRecent(ctx, current, viewer.userId, NOW);
      await insertMaterialRecent(ctx, missingFirst, viewer.userId, NOW + 200);
      await insertMaterialRecent(ctx, missingSecond, viewer.userId, NOW + 100);
      return viewer;
    });

    const results = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 1,
      });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: current.graph.assetId,
        route: current.publicPath,
        title: current.metadata.title,
      }),
    ]);
  });

  it("returns no cards for a zero result limit", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [FUNCTION_MATERIAL]);
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-zero-limit",
      })
    );

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.contents.queries.recent.getRecentlyViewed, {
          locale: "en",
          limit: 0,
        })
    ).resolves.toEqual([]);
  });

  it("returns no cards without an authenticated learner", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [FUNCTION_MATERIAL]);

    await expect(
      t.query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      })
    ).resolves.toEqual([]);
  });
});
