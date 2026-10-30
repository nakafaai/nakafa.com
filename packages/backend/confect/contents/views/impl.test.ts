import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content/material";
import {
  ARTICLE_VIEW_ID as ARTICLE_CONTENT_ID,
  ARTICLE_VIEW_ROUTE as ARTICLE_ROUTE,
  canonicalViewContext as canonicalContext,
  getContentViewPartition as getSignalPartition,
  insertContentViewArticle as insertArticle,
  insertContentViewMaterial as insertMaterial,
  makeArticleViewArgs,
  makeMaterialViewArgs,
  CONTENT_VIEW_NOW as NOW,
  readContentViewState as readViewState,
} from "@repo/backend/test/content/view";
import { convexTest } from "convex-test";
import { Array as Arr } from "effect";

describe("contents/views/impl", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records a first anonymous material view and schedules analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const material = await t.mutation((ctx) => insertMaterial(ctx));
    await expect(
      t.mutation(api.contents.mutations.views.recordContentView, {
        ...makeMaterialViewArgs("missing"),
        publicPath: "subjects/mathematics/missing",
      })
    ).resolves.toEqual({
      success: false,
      isNewView: false,
      alreadyViewed: false,
    });

    // The view comes a minute after the setup: Convex runs each mutation after
    // the commits before it, so the view whose time the test reads gets its own.
    const viewedAt = NOW + 60_000;
    vi.setSystemTime(viewedAt);
    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeMaterialViewArgs("device-1")
    );

    const state = await readViewState(t);
    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toMatchObject([
      {
        assetId: material.contentId,
        content_id: material.contentId,
        contextKey: "canonical",
        contextMode: "canonical",
        deviceId: "device-1",
        firstViewedAt: viewedAt,
        lastViewedAt: viewedAt,
        locale: "en",
        route: FUNCTION_MATERIAL.publicPath,
        section: "material",
      },
    ]);
    expect(state.engagementQueue).toMatchObject([
      {
        assetId: material.contentId,
        content_id: material.contentId,
        contextKey: "canonical",
        contextMode: "canonical",
        locale: "en",
        partition: getSignalPartition(material.contentId),
        route: FUNCTION_MATERIAL.publicPath,
        section: "material",
        scopeMode: "global",
        viewerKey: "device:device-1",
        viewedAt,
      },
    ]);
    expect(state.viewerSignals).toMatchObject([
      {
        ...canonicalContext,
        content_id: material.contentId,
        scopeMode: "global",
        viewerKey: "device:device-1",
      },
    ]);
    expect(Arr.map(state.scheduledJobs, (job) => job.args[0])).toEqual([
      { partition: getSignalPartition(material.contentId) },
    ]);
  });

  it("records an article view without any popularity work", async () => {
    const t = createConvexTestWithBetterAuth();
    const article = await t.mutation((ctx) => insertArticle(ctx));

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(article.contentId, "device-1")
    );

    const state = await readViewState(t);
    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toMatchObject([
      {
        content_id: article.contentId,
        deviceId: "device-1",
        route: ARTICLE_ROUTE,
        section: "articles",
      },
    ]);
    // No homepage ranking reads an article, so nothing is queued for one.
    expect(state.engagementQueue).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
  });

  it("updates an existing device view without queuing duplicate analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) => insertMaterial(ctx));
    await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeMaterialViewArgs("device-1")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeMaterialViewArgs("device-1")
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });
    expect(state.views).toHaveLength(1);
    expect(state.views[0]).toMatchObject({
      firstViewedAt: NOW,
      lastViewedAt: NOW + 1000,
    });
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
  });

  it("records nothing for a signed-out view without a device identifier", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) => insertMaterial(ctx));

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeMaterialViewArgs()
    );

    const state = await readViewState(t);
    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: false,
      success: false,
    });
    expect(state.engagementQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
    expect(state.views).toEqual([]);
  });

  it("does not treat a prepared signed-in viewer as anonymous", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const material = await insertMaterial(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-viewer",
      });
      await ctx.db.patch("users", user.userId, {
        deletionPreparedAt: NOW,
      });

      return { ...user, contentId: material.contentId };
    });

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .mutation(
          api.contents.mutations.views.recordContentView,
          makeMaterialViewArgs("prepared-device")
        )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_VIEW_IO_FAILED",
        message: "Unable to record the content view.",
      },
    });

    const state = await readViewState(t);
    expect(state.engagementQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
    expect(state.views).toEqual([]);
  });

  it("reports auth component IO failures through the typed boundary", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t
        .withIdentity({
          sessionId: "missing-session",
          subject: "missing-auth-user",
        })
        .mutation(
          api.contents.mutations.views.recordContentView,
          makeArticleViewArgs(ARTICLE_CONTENT_ID, "device-1")
        )
    ).rejects.toMatchObject({
      data: {
        _tag: "AuthReadError",
        code: "AUTH_READ_FAILED",
        message: "Unable to read authentication state.",
      },
    });
  });
});
