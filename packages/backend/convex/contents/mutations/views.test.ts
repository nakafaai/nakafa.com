import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
const ARTICLE_ROUTE = "articles/politics/views";
const ARTICLE_CONTENT_ID = "asset:id:catalog:article:views";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const SUBJECT_CONTENT_ID = "asset:id:catalog:subject:views";
const EXERCISE_ROUTE =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";
const EXERCISE_CONTENT_ID = "asset:id:catalog:exercise:views";
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/** Builds one route-catalog graph fixture from the route shape under test. */
function getGraphFixture(route: string) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!graph) {
    throw new Error(`Unable to build graph fixture for route "${route}".`);
  }

  return graph;
}

/** Inserts one graph route-catalog row for content-view mutation tests. */
async function insertContentRoute(
  ctx: MutationCtx,
  source: {
    readonly contentId: string;
    readonly kind: Doc<"contentRoutes">["kind"];
    readonly route: string;
    readonly section: Doc<"contentRoutes">["section"];
    readonly title: string;
  }
) {
  const graph = getGraphFixture(source.route);

  await ctx.db.insert("contentRoutes", {
    ...graph,
    assetId: source.contentId,
    authors: [],
    contentHash: `route-hash-${source.contentId}`,
    content_id: source.contentId,
    kind: source.kind,
    locale: "id",
    markdown: true,
    route: source.route,
    section: source.section,
    sourcePath: source.route,
    syncedAt: NOW,
    title: source.title,
  });

  return source.contentId;
}

/** Inserts one article content row for content-view mutation tests. */
async function insertArticle(
  ctx: MutationCtx,
  slug = ARTICLE_ROUTE,
  contentId = ARTICLE_CONTENT_ID
) {
  const id = await ctx.db.insert("articleContents", {
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

  await insertContentRoute(ctx, {
    contentId,
    kind: "article",
    route: slug,
    section: "articles",
    title: "Views",
  });

  return { contentId, id };
}

/** Inserts one curriculum lesson row for content-view mutation tests. */
async function insertSubject(ctx: MutationCtx) {
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: "id",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: "material/lesson/mathematics/vector",
    syncedAt: NOW,
    title: "Vector",
    topic: "vector",
  });

  const id = await ctx.db.insert("curriculumLessons", {
    body: "Subject body",
    contentHash: "subject-hash",
    date: NOW,
    description: "Subject description",
    locale: "id",
    material: "mathematics",
    order: 0,
    section: "addition",
    slug: "material/lesson/mathematics/vector/addition",
    subject: "Vector",
    syncedAt: NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });

  await insertContentRoute(ctx, {
    contentId: SUBJECT_CONTENT_ID,
    kind: "curriculum-lesson",
    route: SUBJECT_ROUTE,
    section: "material",
    title: "Vector Addition",
  });

  return { contentId: SUBJECT_CONTENT_ID, id };
}

/** Inserts one exercise set row for content-view mutation tests. */
async function insertExerciseSet(ctx: MutationCtx) {
  const id = await ctx.db.insert("exerciseSets", {
    category: "high-school",
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    questionCount: 20,
    setName: "set-1",
    slug: EXERCISE_ROUTE,
    syncedAt: NOW,
    title: "Views",
    type: "snbt",
  });

  await insertContentRoute(ctx, {
    contentId: EXERCISE_CONTENT_ID,
    kind: "exercise-set",
    route: EXERCISE_ROUTE,
    section: "material",
    title: "Views",
  });

  return { contentId: EXERCISE_CONTENT_ID, id };
}

/** Returns the analytics partition for one popularity signal scope. */
function getSignalPartition(contentId: string) {
  return getContentAnalyticsPartition(`${contentId}:global:canonical`);
}

/** Returns whether one scheduled job is the analytics partition scheduler. */
function isAnalyticsPartitionJob(job: { args: readonly unknown[] }) {
  const [arg] = job.args;

  return typeof arg === "object" && arg !== null && "partition" in arg;
}

/** Reads content-view state that should remain small in each test fixture. */
async function readViewState(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  return await t.query(async (ctx) => ({
    engagementQueue: await ctx.db.query("learningEngagementQueue").collect(),
    recents: await ctx.db.query("userLearningRecents").collect(),
    scheduledJobs: (
      await ctx.db.system.query("_scheduled_functions").collect()
    ).filter(isAnalyticsPartitionJob),
    viewerSignals: await ctx.db
      .query("learningPopularityViewerSignals")
      .collect(),
    views: await ctx.db.query("learningViews").collect(),
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
    const article = await t.mutation((ctx) => insertArticle(ctx));

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: article.contentId,
        deviceId: "device-1",
        locale: "id",
      }
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
        locale: "id",
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
        locale: "id",
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

  it("updates an existing device view without queuing duplicate analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const article = await t.mutation((ctx) => insertArticle(ctx));
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentId: article.contentId,
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: article.contentId,
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
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
  });

  it("links an anonymous view to a user without duplicate popularity analytics", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const article = await insertArticle(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "viewer",
      });

      return { ...user, contentId: article.contentId };
    });
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentId: identity.contentId,
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
        contentId: identity.contentId,
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

  it("deduplicates signed-in user views across devices", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const article = await insertArticle(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cross-device-viewer",
      });

      return { ...user, contentId: article.contentId };
    });
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: identity.contentId,
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await signedIn.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: identity.contentId,
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

  it("reuses the stored user viewer key after a signed-in learner signs out", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const article = await insertArticle(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "signed-out-repeat",
      });

      return { ...user, contentId: article.contentId };
    });
    const signedIn = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: identity.contentId,
      deviceId: "device-1",
      locale: "id",
    });

    vi.setSystemTime(NOW + 1000);

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: identity.contentId,
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
      lastViewedAt: NOW + 1000,
      userId: identity.userId,
    });
    expect(state.engagementQueue).toHaveLength(1);
    expect(state.scheduledJobs).toHaveLength(1);
    expect(state.viewerSignals).toHaveLength(1);
  });

  it("returns a best-effort miss when the graph content ID has no route row", async () => {
    const t = createConvexTestWithBetterAuth();

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: "asset:id:missing",
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
    expect(state.engagementQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
  });

  it("returns best-effort misses for route kinds without tracked source rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const curriculumTopicContentId = await t.mutation((ctx) =>
      insertContentRoute(ctx, {
        contentId: "asset:id:catalog:curriculum-topic:views",
        kind: "curriculum-topic",
        route: "material/lesson/mathematics/vector",
        section: "material",
        title: "Vector",
      })
    );
    const quranContentId = await t.mutation((ctx) =>
      insertContentRoute(ctx, {
        contentId: "asset:id:catalog:quran:1",
        kind: "quran-surah",
        route: "quran/1",
        section: "quran",
        title: "Al-Fatihah",
      })
    );

    const subjectResult = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: curriculumTopicContentId,
        deviceId: "device-subject",
        locale: "id",
      }
    );
    const exerciseResult = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: quranContentId,
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
    expect(state.engagementQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
  });

  it("returns a best-effort miss for mismatched route catalog graph IDs", async () => {
    const t = createConvexTestWithBetterAuth();
    const staleContentId = `${ARTICLE_CONTENT_ID}:stale`;

    await t.mutation(async (ctx) => {
      await insertArticle(ctx);
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ARTICLE_CONTENT_ID)
        )
        .unique();

      if (!route) {
        throw new Error("Expected article route fixture.");
      }

      await ctx.db.patch(route._id, { content_id: staleContentId });
    });

    const result = await t.mutation(
      api.contents.mutations.views.recordContentView,
      {
        contentId: staleContentId,
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
    expect(state.engagementQueue).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.viewerSignals).toEqual([]);
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
          contentId: ARTICLE_CONTENT_ID,
          deviceId: "device-1",
          locale: "id",
        })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_VIEW_IO_FAILED",
      },
    });
  });

  it("resolves subject and exercise graph IDs through the route catalog", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixtures = await t.mutation(async (ctx) => ({
      exercise: await insertExerciseSet(ctx),
      subject: await insertSubject(ctx),
    }));

    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixtures.subject.contentId,
      deviceId: "device-subject",
      locale: "id",
    });
    await t.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixtures.exercise.contentId,
      deviceId: "device-exercise",
      locale: "id",
    });

    const state = await readViewState(t);
    const refs = state.views.map((view) => view.content_id);

    expect(refs).toEqual(
      expect.arrayContaining([
        fixtures.subject.contentId,
        fixtures.exercise.contentId,
      ])
    );
    expect(state.engagementQueue).toHaveLength(2);
    expect(state.viewerSignals).toHaveLength(2);
  });
});
