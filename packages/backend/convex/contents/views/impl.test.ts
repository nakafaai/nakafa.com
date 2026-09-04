import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createContextKey,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import { enqueuePopularitySignals } from "@repo/backend/convex/contents/views/signals";
import type { ContentViewTarget } from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import {
  ARTICLE_VIEW_ID as ARTICLE_CONTENT_ID,
  ARTICLE_VIEW_ROUTE as ARTICLE_ROUTE,
  canonicalViewContext as canonicalContext,
  getContentViewDistinctId as getScheduledDistinctId,
  getContentViewPartition as getSignalPartition,
  insertContentViewArticle as insertArticle,
  makeArticleViewArgs,
  CONTENT_VIEW_NOW as NOW,
  readContentViewState as readViewState,
  seedArticleViewer,
} from "@repo/backend/test/content/view";
import { convexTest } from "convex-test";

describe("contents/views/impl", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records a first anonymous article view and schedules analytics", async () => {
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
        assetId: article.contentId,
        content_id: article.contentId,
        contextKey: "canonical",
        contextMode: "canonical",
        deviceId: "device-1",
        firstViewedAt: NOW,
        lastViewedAt: NOW,
        locale: "en",
        route: ARTICLE_ROUTE,
        section: "articles",
      },
    ]);
    expect(state.engagementQueue).toMatchObject([
      {
        assetId: article.contentId,
        content_id: article.contentId,
        contextKey: "canonical",
        contextMode: "canonical",
        locale: "en",
        partition: getSignalPartition(article.contentId),
        route: ARTICLE_ROUTE,
        section: "articles",
        scopeMode: "global",
        viewerKey: "device:device-1",
        viewedAt: NOW,
      },
    ]);
    expect(state.viewerSignals).toMatchObject([
      {
        ...canonicalContext,
        content_id: article.contentId,
        scopeMode: "global",
        viewerKey: "device:device-1",
      },
    ]);
    expect(state.scheduledJobs.map((job) => job.args[0])).toEqual([
      { partition: getSignalPartition(article.contentId) },
    ]);
  });

  it("enqueues both global and placement popularity for a verified context", async () => {
    const t = convexTest(schema, convexModules);
    const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
    const route = {
      ...graph,
      contentKey: "material.lesson.mathematics.vector.addition",
      content_id: graph.assetId,
      kind: "curriculum-lesson",
      locale: "en",
      materialDomain: MaterialDomainSchema.make("mathematics"),
      materialKey: "lesson.mathematics.vector.addition",
      parentPath: "material/lesson/mathematics/vector",
      route: "material/lesson/mathematics/vector/addition",
      section: "material",
      sourcePath: "material.lesson.mathematics.vector.addition.en.mdx",
      title: "Vector Addition",
    } satisfies ContentViewTarget;
    const context = {
      contextKey: createContextKey({
        mode: "placement",
        nodeKey: "class-10-mathematics-vector",
        programKey: "merdeka",
      }),
      contextMaterialKey: route.materialKey,
      contextMode: "placement",
      contextNodeKey: "class-10-mathematics-vector",
      contextParentPath: "curriculum/merdeka/class-10/mathematics",
      contextProgramKey: "merdeka",
      contextPublicPath: "curriculum/merdeka/class-10/mathematics/vector",
      contextSourcePath: route.contentKey,
    } satisfies LearningContextStorage;

    const partitions = await t.mutation((ctx) =>
      runConvexProgram(
        enqueuePopularitySignals(
          ctx.db,
          route,
          {
            contentId: route.content_id,
            deviceId: "placement-device",
            locale: "en",
            publicPath: route.route,
            section: "material",
          },
          context,
          { now: NOW }
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      queue: await ctx.db.query("learningEngagementQueue").collect(),
      signals: await ctx.db.query("learningPopularityViewerSignals").collect(),
    }));

    expect(partitions).toHaveLength(2);
    expect(state.queue).toHaveLength(2);
    expect(state.signals).toHaveLength(2);
    expect(state.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contextKey: "canonical",
          contextMode: "canonical",
          scopeMode: "global",
        }),
        expect.objectContaining({
          contextKey: context.contextKey,
          contextMode: "placement",
          scopeMode: "placement",
        }),
      ])
    );
  });

  it("updates an existing device view without queuing duplicate analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const article = await t.mutation((ctx) => insertArticle(ctx));
    await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(article.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(article.contentId, "device-1")
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

  it("links an anonymous view to a user without duplicate popularity analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "viewer")
    );
    await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(
        api.contents.mutations.views.recordContentView,
        makeArticleViewArgs(identity.contentId, "device-1")
      );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });
    expect(state.views).toHaveLength(1);
    expect(state.views[0]).toMatchObject({
      lastViewedAt: NOW + 1000,
      userId: identity.userId,
    });
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.recents).toMatchObject([
      {
        content_id: identity.contentId,
        contextKey: "canonical",
        lastViewedAt: NOW + 1000,
        userId: identity.userId,
      },
    ]);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
  });

  it("keeps view ownership separate for different signed-in users on one device", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const article = await insertArticle(ctx);
      const firstUser = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "shared-device-first",
      });
      const secondUser = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "shared-device-second",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: firstUser.userId,
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: secondUser.userId,
      });

      return { contentId: article.contentId, firstUser, secondUser };
    });
    const firstSignedIn = t.withIdentity({
      sessionId: identity.firstUser.sessionId,
      subject: identity.firstUser.authUserId,
    });
    const secondSignedIn = t.withIdentity({
      sessionId: identity.secondUser.sessionId,
      subject: identity.secondUser.authUserId,
    });

    await firstSignedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "shared-device")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await secondSignedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "shared-device")
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toHaveLength(2);
    expect(state.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: "shared-device",
          lastViewedAt: NOW,
          userId: identity.firstUser.userId,
        }),
        expect.objectContaining({
          deviceId: "shared-device",
          lastViewedAt: NOW + 1000,
          userId: identity.secondUser.userId,
        }),
      ])
    );
    expect(state.recents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: identity.contentId,
          lastViewedAt: NOW,
          userId: identity.firstUser.userId,
        }),
        expect.objectContaining({
          content_id: identity.contentId,
          lastViewedAt: NOW + 1000,
          userId: identity.secondUser.userId,
        }),
      ])
    );
    expect(state.engagementQueue).toHaveLength(2);
    expect(state.viewerSignals).toHaveLength(2);
    expect(state.contentViewEvents.map(getScheduledDistinctId)).toEqual([
      identity.firstUser.userId,
      identity.secondUser.userId,
    ]);
  });

  it("records signed-in user views per device while deduplicating popularity", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "cross-device-viewer")
    );
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-2")
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toHaveLength(2);
    expect(state.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: "device-1",
          lastViewedAt: NOW,
          userId: identity.userId,
        }),
        expect.objectContaining({
          deviceId: "device-2",
          lastViewedAt: NOW + 1000,
          userId: identity.userId,
        }),
      ])
    );
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.recents).toMatchObject([
      {
        content_id: identity.contentId,
        contextKey: "canonical",
        lastViewedAt: NOW + 1000,
        userId: identity.userId,
      },
    ]);
    expect(state.viewerSignals).toHaveLength(1);
  });

  it("treats a signed-out same-device repeat as deduped without mutating ownership", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "signed-out-repeat")
    );
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });
    expect(state.views).toHaveLength(1);
    expect(state.views[0]).toMatchObject({
      lastViewedAt: NOW,
      userId: identity.userId,
    });
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
    expect(state.contentViewEvents).toHaveLength(1);
  });

  it("does not add another same-day popularity signal after cross-device sign-out", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "cross-device-sign-out")
    );
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);

    await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-2")
    );

    vi.setSystemTime(NOW + 2000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-2")
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });
    expect(state.views).toHaveLength(2);
    expect(state.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: "device-1",
          lastViewedAt: NOW,
          userId: identity.userId,
        }),
        expect.objectContaining({
          deviceId: "device-2",
          lastViewedAt: NOW + 1000,
          userId: identity.userId,
        }),
      ])
    );
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.recents).toMatchObject([
      {
        content_id: identity.contentId,
        contextKey: "canonical",
        lastViewedAt: NOW + 1000,
        userId: identity.userId,
      },
    ]);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
    expect(state.contentViewEvents).toHaveLength(2);
  });

  it("does not treat a prepared signed-in viewer as anonymous", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const article = await insertArticle(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-viewer",
      });
      await ctx.db.patch("users", user.userId, {
        deletionPreparedAt: NOW,
      });

      return { ...user, contentId: article.contentId };
    });

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .mutation(
          api.contents.mutations.views.recordContentView,
          makeArticleViewArgs(identity.contentId, "prepared-device")
        )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_VIEW_IO_FAILED",
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
        code: "CONTENT_VIEW_IO_FAILED",
      },
    });
  });
});
