import { api } from "@repo/backend/convex/_generated/api";
import { contentViewRouteCollisionCode } from "@repo/backend/convex/contents/views/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import {
  CONTEXT_NODE_KEY,
  CONTEXT_PARENT_PATH,
  CONTEXT_PUBLIC_PATH,
  LATEST_MATERIAL,
  PLACEMENT_VIEW_NOW,
  PROGRAM_KEY,
  PUBLIC_LESSON_PATH,
  PUBLISHED_CONTEXT_NODE,
  PUBLISHED_MATERIAL,
  PUBLISHED_PLACEMENT,
  RENAMED_MATERIAL,
  recordPublishedView,
  seedContextOwnershipConflict,
  seedContextRouteOverlap,
  seedContextSyncOverlap,
  seedMaterialPlacement,
  seedMixedPlacement,
  seedRouteSyncOverlap,
} from "@repo/backend/test/material-view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("contents/views/context", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: PLACEMENT_VIEW_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists and resumes an exact curriculum placement", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "context-device",
      locale: "id",
      publicPath: PUBLIC_LESSON_PATH,
      section: "material",
    });

    const state = await t.query(async (ctx) => ({
      recents: await ctx.db.query("userLearningRecents").collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));
    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(state.views).toMatchObject([
      {
        contextKey: `placement:${PROGRAM_KEY}:${CONTEXT_NODE_KEY}`,
        contextMode: "placement",
        contextNodeKey: CONTEXT_NODE_KEY,
      },
    ]);
    expect(state.recents).toMatchObject([
      {
        contextParentPath: CONTEXT_PARENT_PATH,
        contextProgramKey: PROGRAM_KEY,
        contextPublicPath: CONTEXT_PUBLIC_PATH,
      },
    ]);
    expect(results).toMatchObject([
      {
        contextKey: `placement:${PROGRAM_KEY}:${CONTEXT_NODE_KEY}`,
        href: `/${PUBLIC_LESSON_PATH}?ctx=${PROGRAM_KEY}~${CONTEXT_NODE_KEY}`,
      },
    ]);
  });

  it("keeps a later direct visit canonical", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "placement-device",
      locale: "id",
      publicPath: PUBLIC_LESSON_PATH,
      section: "material",
    });
    vi.setSystemTime(PLACEMENT_VIEW_NOW + 1000);
    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      deviceId: "direct-device",
      locale: "id",
      publicPath: PUBLIC_LESSON_PATH,
      section: "material",
    });

    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });

  it("stores an unverified client placement as canonical context", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: "merdeka",
      },
      deviceId: "unverified-context-device",
      locale: "id",
      publicPath: PUBLIC_LESSON_PATH,
      section: "material",
    });

    const state = await t.query(async (ctx) => ({
      recents: await ctx.db.query("userLearningRecents").collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));
    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(state.views).toMatchObject([
      { contextKey: "canonical", contextMode: "canonical" },
    ]);
    expect(state.recents).toMatchObject([
      { contextKey: "canonical", contextMode: "canonical" },
    ]);
    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });

  it("drops a stored placement when the current projection no longer owns it", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "stale-device",
      locale: "id",
      publicPath: PUBLIC_LESSON_PATH,
      section: "material",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.delete(fixture.placementId);
    });

    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });

  it("uses stable source placement after a published material route changes", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [RENAMED_MATERIAL]);
    const viewer = await t.mutation((ctx) => seedMixedPlacement(ctx));
    await recordPublishedView(
      t,
      viewer,
      "published-material-context",
      RENAMED_MATERIAL.publicPath
    );

    await expect(
      t.query((ctx) => ctx.db.query("userLearningRecents").unique())
    ).resolves.toMatchObject({
      contextKey: `placement:${PUBLISHED_PLACEMENT.programKey}:${PUBLISHED_CONTEXT_NODE}`,
      contextSourcePath: PUBLISHED_MATERIAL.contentKey,
      route: RENAMED_MATERIAL.publicPath,
    });
  });

  it("keeps placement while equivalent curriculum shards overlap", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [RENAMED_MATERIAL]);
    const viewer = await t.mutation((ctx) => seedMixedPlacement(ctx));
    await t.mutation(seedContextRouteOverlap);
    await recordPublishedView(
      t,
      viewer,
      "curriculum-route-overlap",
      RENAMED_MATERIAL.publicPath
    );

    await expect(
      t.query((ctx) => ctx.db.query("userLearningRecents").unique())
    ).resolves.toMatchObject({
      contextKey: `placement:${PUBLISHED_PLACEMENT.programKey}:${PUBLISHED_CONTEXT_NODE}`,
      contextSourcePath: PUBLISHED_MATERIAL.contentKey,
      route: RENAMED_MATERIAL.publicPath,
    });
  });

  it("rejects conflicting curriculum ownership during overlap", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [RENAMED_MATERIAL]);
    const viewer = await t.mutation((ctx) => seedMixedPlacement(ctx));
    await t.mutation(seedContextOwnershipConflict);
    await recordPublishedView(
      t,
      viewer,
      "curriculum-owner-conflict",
      RENAMED_MATERIAL.publicPath
    );

    await expect(
      t.query((ctx) => ctx.db.query("userLearningRecents").unique())
    ).resolves.toMatchObject({
      contextKey: "canonical",
      route: RENAMED_MATERIAL.publicPath,
    });
  });

  it("keeps direct lesson placement while renamed shards overlap", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [RENAMED_MATERIAL]);
    const viewer = await t.mutation((ctx) =>
      seedMixedPlacement(ctx, PUBLISHED_MATERIAL.publicPath)
    );
    await t.mutation(seedContextSyncOverlap);
    await recordPublishedView(
      t,
      viewer,
      "overlapping-material-context",
      RENAMED_MATERIAL.publicPath
    );

    await expect(
      t.query((ctx) => ctx.db.query("userLearningRecents").unique())
    ).resolves.toMatchObject({
      contextKey: `placement:${PUBLISHED_PLACEMENT.programKey}:${PUBLISHED_CONTEXT_NODE}`,
      contextSourcePath: PUBLISHED_MATERIAL.contentKey,
      route: RENAMED_MATERIAL.publicPath,
    });
  });

  it("keeps stable topic placement while the published parent changes", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [LATEST_MATERIAL]);
    const viewer = await t.mutation((ctx) => seedMixedPlacement(ctx));
    await t.mutation(seedRouteSyncOverlap);
    await recordPublishedView(
      t,
      viewer,
      "ambiguous-material-context",
      LATEST_MATERIAL.publicPath
    );

    await expect(
      t.query((ctx) => ctx.db.query("userLearningRecents").unique())
    ).resolves.toMatchObject({
      contextKey: `placement:${PUBLISHED_PLACEMENT.programKey}:${PUBLISHED_CONTEXT_NODE}`,
      contextSourcePath: PUBLISHED_MATERIAL.contentKey,
      route: LATEST_MATERIAL.publicPath,
    });
  });

  it("rejects route collisions beyond the bounded rename overlap", async () => {
    const t = createConvexTestWithBetterAuth();
    await activateMaterialCatalog(t, [RENAMED_MATERIAL]);
    const viewer = await t.mutation((ctx) =>
      seedMixedPlacement(ctx, PUBLISHED_MATERIAL.publicPath)
    );
    await t.mutation(seedContextSyncOverlap);

    const thirdSourceId = await t.mutation((ctx) =>
      ctx.db.insert("publicRoutes", {
        contentHash: "latest-material-source-route",
        kind: LATEST_MATERIAL.kind,
        locale: LATEST_MATERIAL.locale,
        materialKey: LATEST_MATERIAL.materialKey,
        parentPath: LATEST_MATERIAL.parentPath,
        publicPath: LATEST_MATERIAL.publicPath,
        sitemap: LATEST_MATERIAL.sitemap,
        sourcePath: LATEST_MATERIAL.contentKey,
        syncShard: 2,
        title: LATEST_MATERIAL.metadata.title,
      })
    );
    await expect(
      recordPublishedView(
        t,
        viewer,
        "source-collision",
        RENAMED_MATERIAL.publicPath
      )
    ).rejects.toMatchObject({
      data: { code: contentViewRouteCollisionCode },
    });

    await t.mutation(async (ctx) => {
      await ctx.db.delete(thirdSourceId);
      await ctx.db.insert("publicRoutes", {
        ...PUBLISHED_PLACEMENT,
        canonicalPath: RENAMED_MATERIAL.publicPath,
        contentHash: "latest-material-source-placement",
        publicPath: `${PUBLISHED_PLACEMENT.publicPath}-latest`,
        syncShard: 2,
      });
    });
    await expect(
      recordPublishedView(
        t,
        viewer,
        "context-collision",
        RENAMED_MATERIAL.publicPath
      )
    ).rejects.toMatchObject({
      data: { code: contentViewRouteCollisionCode },
    });
  });
});
