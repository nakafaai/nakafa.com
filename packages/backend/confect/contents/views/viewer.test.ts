import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  getContentViewDistinctId as getScheduledDistinctId,
  insertContentViewArticle as insertArticle,
  makeArticleViewArgs,
  CONTENT_VIEW_NOW as NOW,
  readContentViewState as readViewState,
  seedArticleViewer,
} from "@repo/backend/test/content/view";
import { Array as Arr, Option, Order } from "effect";

describe("contents/views/viewer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    await expect(
      firstSignedIn.mutation(
        api.contents.mutations.views.recordContentView,
        makeArticleViewArgs(identity.contentId, "shared-device")
      )
    ).resolves.toMatchObject({ alreadyViewed: true, isNewView: false });
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
    expect(Arr.map(state.contentViewEvents, getScheduledDistinctId)).toEqual([
      identity.firstUser.userId,
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

  it("keeps an account view without a device apart from anonymous device rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "account-only")
    );
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    await t.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    vi.setSystemTime(NOW + 1000);
    await expect(
      signedIn.mutation(
        api.contents.mutations.views.recordContentView,
        makeArticleViewArgs(identity.contentId)
      )
    ).resolves.toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });

    vi.setSystemTime(NOW + 2000);
    await expect(
      signedIn.mutation(
        api.contents.mutations.views.recordContentView,
        makeArticleViewArgs(identity.contentId)
      )
    ).resolves.toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });

    const state = await readViewState(t);
    const deviceView = Option.getOrUndefined(
      Arr.findFirst(state.views, (view) => view.deviceId === "device-1")
    );
    const accountView = Option.getOrUndefined(
      Arr.findFirst(state.views, (view) => view.userId === identity.userId)
    );
    expect(state.views).toHaveLength(2);
    expect(deviceView).not.toHaveProperty("userId");
    expect(accountView).not.toHaveProperty("deviceId");
    expect(accountView).toMatchObject({
      firstViewedAt: NOW + 1000,
      lastViewedAt: NOW + 2000,
    });
    expect(state.recents).toMatchObject([
      { lastViewedAt: NOW + 2000, userId: identity.userId },
    ]);
    expect(
      Arr.sort(
        Arr.map(state.viewerSignals, (signal) => signal.viewerKey),
        Order.String
      )
    ).toEqual(["device:device-1", `user:${identity.userId}`]);
  });

  it("adds a consented device row without a second same-day account signal", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedArticleViewer(ctx, "later-consent")
    );
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId)
    );

    vi.setSystemTime(NOW + 1000);
    const result = await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      makeArticleViewArgs(identity.contentId, "device-1")
    );

    const state = await readViewState(t);
    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toHaveLength(2);
    expect(
      Option.getOrUndefined(
        Arr.findFirst(state.views, (view) => view.deviceId === undefined)
      )
    ).toMatchObject({ lastViewedAt: NOW, userId: identity.userId });
    expect(
      Option.getOrUndefined(
        Arr.findFirst(state.views, (view) => view.deviceId === "device-1")
      )
    ).toMatchObject({ lastViewedAt: NOW + 1000, userId: identity.userId });
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
  });
});
