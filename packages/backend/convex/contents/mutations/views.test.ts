import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import type { ContentRef } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 10, 0, 0);

/** Inserts one article content row for content-view mutation tests. */
function insertArticle(ctx: MutationCtx, slug = "articles/politics/views") {
  return ctx.db.insert("articleContents", {
    articleSlug: slug.split("/").at(-1) ?? "views",
    body: "Article body",
    category: "politics",
    contentHash: `hash-${slug}`,
    date: NOW,
    description: "Article description",
    locale: "id",
    slug,
    syncedAt: NOW,
    title: "Views",
  });
}

/** Inserts one subject section row for content-view mutation tests. */
async function insertSubject(ctx: MutationCtx) {
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "id",
    material: "mathematics",
    sectionCount: 1,
    slug: "subject/high-school/10/mathematics/vector",
    syncedAt: NOW,
    title: "Vector",
    topic: "vector",
  });

  return await ctx.db.insert("subjectSections", {
    body: "Subject body",
    category: "high-school",
    contentHash: "subject-hash",
    date: NOW,
    description: "Subject description",
    grade: "10",
    locale: "id",
    material: "mathematics",
    section: "addition",
    slug: "subject/high-school/10/mathematics/vector/addition",
    subject: "Vector",
    syncedAt: NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });
}

/** Inserts one exercise set row for content-view mutation tests. */
function insertExerciseSet(ctx: MutationCtx) {
  return ctx.db.insert("exerciseSets", {
    category: "high-school",
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    questionCount: 20,
    setName: "views",
    slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/views",
    syncedAt: NOW,
    title: "Views",
    type: "snbt",
  });
}

/** Reads content-view state that should remain small in each test fixture. */
async function readViewState(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  return await t.query(async (ctx) => ({
    analyticsQueue: await ctx.db.query("contentViewAnalyticsQueue").collect(),
    scheduledJobs: await ctx.db.system.query("_scheduled_functions").collect(),
    views: await ctx.db.query("contentViews").collect(),
  }));
}

describe("contents/mutations/views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records a first anonymous article view and schedules analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const articleId = await t.mutation((ctx) => insertArticle(ctx));

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: { slug: "articles/politics/views", type: "article" },
        deviceId: "device-1",
        locale: "id",
      }
    );

    const state = await readViewState(t);
    const contentRef = {
      id: articleId,
      type: "article",
    } satisfies ContentRef;

    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    expect(state.views).toMatchObject([
      {
        contentRef,
        deviceId: "device-1",
        firstViewedAt: NOW,
        lastViewedAt: NOW,
        locale: "id",
        slug: "articles/politics/views",
      },
    ]);
    expect(state.analyticsQueue).toMatchObject([
      {
        contentRef,
        locale: "id",
        partition: getContentAnalyticsPartition(contentRef),
        viewedAt: NOW,
      },
    ]);
    expect(state.scheduledJobs.map((job) => job.args[0])).toEqual([
      { partition: getContentAnalyticsPartition(contentRef) },
    ]);
  });

  it("updates an existing device view without queuing duplicate analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) => insertArticle(ctx));
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentRef: { slug: "articles/politics/views", type: "article" },
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: { slug: "articles/politics/views", type: "article" },
        deviceId: "device-1",
        locale: "id",
      }
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
    expect(state.analyticsQueue).toHaveLength(1);
    expect(state.scheduledJobs).toHaveLength(1);
  });

  it("links an existing anonymous device view to a signed-in user", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      await insertArticle(ctx);
      return await seedAuthenticatedUser(ctx, { now: NOW, suffix: "viewer" });
    });
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentRef: { slug: "articles/politics/views", type: "article" },
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.contents.mutations.views.recordContentView, {
        contentRef: { slug: "articles/politics/views", type: "article" },
        deviceId: "device-1",
        locale: "id",
      });

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
    expect(state.analyticsQueue).toHaveLength(1);
  });

  it("deduplicates signed-in user views across devices", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      await insertArticle(ctx);
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cross-device-viewer",
      });
    });
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentRef: { slug: "articles/politics/views", type: "article" },
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: { slug: "articles/politics/views", type: "article" },
        deviceId: "device-2",
        locale: "id",
      }
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: true,
      isNewView: false,
      success: true,
    });
    expect(state.views).toHaveLength(1);
    expect(state.views[0]).toMatchObject({
      deviceId: "device-1",
      lastViewedAt: NOW + 1000,
      userId: identity.userId,
    });
    expect(state.analyticsQueue).toHaveLength(1);
  });

  it("returns a best-effort miss when the public slug has no content row", async () => {
    const t = createConvexTestWithBetterAuth();

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: { slug: "articles/politics/missing", type: "article" },
        deviceId: "device-1",
        locale: "id",
      }
    );

    const state = await readViewState(t);

    expect(result).toEqual({
      alreadyViewed: false,
      isNewView: false,
      success: false,
    });
    expect(state.views).toEqual([]);
    expect(state.analyticsQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
  });

  it("returns best-effort misses for non-article content refs", async () => {
    const t = createConvexTestWithBetterAuth();

    const subjectResult = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: {
          slug: "subject/high-school/10/mathematics/missing/addition",
          type: "subject",
        },
        deviceId: "device-subject",
        locale: "id",
      }
    );
    const exerciseResult = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentRef: {
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/missing",
          type: "exercise",
        },
        deviceId: "device-exercise",
        locale: "id",
      }
    );

    const state = await readViewState(t);

    expect(subjectResult).toEqual({
      alreadyViewed: false,
      isNewView: false,
      success: false,
    });
    expect(exerciseResult).toEqual({
      alreadyViewed: false,
      isNewView: false,
      success: false,
    });
    expect(state.views).toEqual([]);
    expect(state.analyticsQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
  });

  it("reports auth component IO failures through the typed boundary", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t
        .withIdentity({
          sessionId: "missing-session",
          subject: "missing-auth-user",
        })
        .mutation(api.contents.mutations.views.recordContentView, {
          contentRef: { slug: "articles/politics/views", type: "article" },
          deviceId: "device-1",
          locale: "id",
        })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_VIEW_IO_FAILED",
      },
    });
  });

  it("resolves subject and exercise refs through their localized slug indexes", async () => {
    const t = createConvexTestWithBetterAuth();
    const ids = await t.mutation(async (ctx) => ({
      exerciseId: await insertExerciseSet(ctx),
      subjectId: await insertSubject(ctx),
    }));

    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentRef: {
        slug: "subject/high-school/10/mathematics/vector/addition",
        type: "subject",
      },
      deviceId: "device-subject",
      locale: "id",
    });
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentRef: {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/views",
        type: "exercise",
      },
      deviceId: "device-exercise",
      locale: "id",
    });

    const state = await readViewState(t);
    const refs = state.views.map((view) => view.contentRef);

    expect(refs).toEqual(
      expect.arrayContaining([
        { id: ids.subjectId, type: "subject" },
        { id: ids.exerciseId, type: "exercise" },
      ])
    );
    expect(state.analyticsQueue).toHaveLength(2);
  });
});
