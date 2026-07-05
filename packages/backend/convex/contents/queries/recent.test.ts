import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext: CanonicalRecentContextFixture = {
  contextKey: "canonical",
  contextMode: "canonical",
};

describe("contents/queries/recent", () => {
  it("returns recently viewed materials through graph route projections", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-viewer",
      });
      const lessonId = await insertCurriculumLesson(ctx, "viewed");
      const ref = await insertMaterialRoute(ctx, "viewed");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "viewed",
        userId: identity.userId,
      });

      return { ...identity, lessonId, ref };
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: seeded.ref.assetId,
        content_id: seeded.ref.assetId,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        route: "subjects/mathematics/topic-viewed/section-viewed",
        title: "Material viewed",
        url: "https://nakafa.com/en/subjects/mathematics/topic-viewed/section-viewed",
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
    expect(seeded.lessonId).not.toBe(seeded.ref.assetId);
  });

  it("drops recently viewed materials without material-domain projection", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-missing-domain",
      });
      const ref = getMaterialGraph("missing-domain");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        suffix: "missing-domain",
        userId: identity.userId,
      });

      return identity;
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

    expect(results).toEqual([]);
  });

  it("uses the current route projection when a recent row has stale route copy", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-stale-route",
      });
      const ref = await insertMaterialRoute(ctx, "stale-route");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "stale-route",
        userId: identity.userId,
      });

      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.assetId))
        .unique();

      if (!route) {
        expect.fail("Expected content route for stale recent fixture.");
      }

      await ctx.db.patch(route._id, {
        route: "subjects/mathematics/topic-current/section-current",
        title: "Material current",
      });

      return { ...identity, ref };
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        href: "/subjects/mathematics/topic-current/section-current",
        route: "subjects/mathematics/topic-current/section-current",
        title: "Material current",
      }),
    ]);
  });

  it("preserves the latest verified material context in the Continue Learning href", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-context-href",
      });
      const ref = await insertMaterialRoute(ctx, "recent-context-href");

      await insertMaterialRecent(ctx, {
        context: {
          contextKey: "placement:merdeka:class-10-mathematics-topic",
          contextMode: "placement",
          contextNodeKey: "class-10-mathematics-topic",
          contextProgramKey: "merdeka",
        },
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "recent-context-href",
        userId: identity.userId,
      });

      return identity;
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        contextKey: "placement:merdeka:class-10-mathematics-topic",
        href: "/subjects/mathematics/topic-recent-context-href/section-recent-context-href?ctx=merdeka~class-10-mathematics-topic",
      }),
    ]);
  });

  it("drops try-out recents from material Continue Learning cards", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-tryout",
      });
      const ref = await insertTryoutRoute(ctx, "recent-tryout");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "recent-tryout",
        userId: identity.userId,
      });

      return identity;
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

    expect(results).toEqual([]);
  });

  it("pages past filtered try-out recents to fill Continue Learning cards", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-page-past-tryout",
      });
      const tryoutRef = await insertTryoutRoute(ctx, "recent-page-tryout");
      const materialRef = await insertMaterialRoute(
        ctx,
        "recent-page-material"
      );

      for (let index = 0; index < 20; index++) {
        await insertMaterialRecent(ctx, {
          ref: tryoutRef,
          lastViewedAt: NOW + 100 - index,
          materialDomain: "mathematics",
          suffix: `recent-page-tryout-${index}`,
          userId: identity.userId,
        });
      }

      await insertMaterialRecent(ctx, {
        ref: materialRef,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "recent-page-material",
        userId: identity.userId,
      });

      return { ...identity, materialRef };
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 1,
      });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: seeded.materialRef.assetId,
        route:
          "subjects/mathematics/topic-recent-page-material/section-recent-page-material",
        title: "Material recent-page-material",
      }),
    ]);
  });
});

/** Inserts one curriculum lesson row for recently viewed query tests. */
async function insertCurriculumLesson(ctx: MutationCtx, suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: `material/lesson/mathematics/topic-${suffix}`,
    syncedAt: NOW,
    title: `Topic ${suffix}`,
    topic: `topic-${suffix}`,
  });

  return await ctx.db.insert("curriculumLessons", {
    body: "Material body",
    contentHash: `material-hash-${suffix}`,
    date: NOW,
    description: `Description ${suffix}`,
    locale: "en",
    material: "mathematics",
    order: 0,
    section: `section-${suffix}`,
    slug: route,
    subject: `Topic ${suffix}`,
    syncedAt: NOW,
    title: `Material ${suffix}`,
    topic: `topic-${suffix}`,
    topicId,
  });
}

/** Inserts the route catalog graph projection for one curriculum lesson. */
async function insertMaterialRoute(ctx: MutationCtx, suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const identity = getMaterialGraph(suffix);

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `material-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Description ${suffix}`,
    kind: "curriculum-lesson",
    locale: "en",
    markdown: true,
    materialDomain: "mathematics",
    route: getPublicMaterialLessonRoute(suffix),
    section: "material",
    sourcePath: route,
    syncedAt: NOW,
    title: `Material ${suffix}`,
  });

  return identity;
}

/** Inserts the route catalog graph projection for one try-out set. */
async function insertTryoutRoute(ctx: MutationCtx, suffix: string) {
  const route = `try-out/indonesia/snbt/${suffix}`;
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    expect.fail(`Expected try-out graph identity for ${route}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `tryout-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Try-out ${suffix}`,
    kind: "tryout-set",
    locale: "en",
    markdown: true,
    materialDomain: "mathematics",
    route,
    section: "tryout",
    sourcePath: route,
    syncedAt: NOW,
    title: `Try-out ${suffix}`,
  });

  return identity;
}

/** Inserts one signed-in Continue Learning read-model row. */
async function insertMaterialRecent(
  ctx: MutationCtx,
  {
    context = canonicalContext,
    ref,
    lastViewedAt,
    materialDomain,
    suffix,
    userId,
  }: {
    context?: typeof canonicalContext | RecentContextFixture;
    ref: ReturnType<typeof getMaterialGraph>;
    lastViewedAt: number;
    materialDomain?: Doc<"userLearningRecents">["materialDomain"];
    suffix: string;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("userLearningRecents", {
    ...ref,
    ...context,
    content_id: ref.assetId,
    description: `Description ${suffix}`,
    lastViewedAt,
    locale: "en",
    ...(materialDomain ? { materialDomain } : {}),
    route: getPublicMaterialLessonRoute(suffix),
    section: "material",
    sourcePath: getMaterialLessonRoute(suffix),
    title: `Material ${suffix}`,
    userId,
  });
}

interface CanonicalRecentContextFixture {
  readonly contextKey: "canonical";
  readonly contextMode: "canonical";
}

interface RecentContextFixture {
  readonly contextKey: string;
  readonly contextMode: "placement";
  readonly contextNodeKey: string;
  readonly contextProgramKey: string;
}

/** Builds the route-catalog graph identity for one material fixture. */
function getMaterialGraph(suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    expect.fail(`Expected material graph identity for ${route}.`);
  }

  return identity;
}

/** Builds the canonical material route used by recent-query fixtures. */
function getMaterialLessonRoute(suffix: string) {
  return `material/lesson/mathematics/topic-${suffix}/section-${suffix}`;
}

/** Builds the public material route used by recent-query route projections. */
function getPublicMaterialLessonRoute(suffix: string) {
  return `subjects/mathematics/topic-${suffix}/section-${suffix}`;
}
