import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

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

      await insertMaterialView(ctx, {
        ref,
        lastViewedAt: NOW,
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

  it("drops recently viewed materials without graph route projections", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-missing-route",
      });
      await insertCurriculumLesson(ctx, "missing-route");
      const ref = getMaterialGraph("missing-route");

      await insertMaterialView(ctx, {
        ref,
        lastViewedAt: NOW,
        suffix: "missing-route",
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

/** Inserts one material content-view row for the signed-in user. */
async function insertMaterialView(
  ctx: MutationCtx,
  {
    ref,
    lastViewedAt,
    suffix,
    userId,
  }: {
    ref: ReturnType<typeof getMaterialGraph>;
    lastViewedAt: number;
    suffix: string;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("contentViews", {
    ...ref,
    content_id: ref.assetId,
    deviceId: "device-recent",
    firstViewedAt: NOW,
    lastViewedAt,
    locale: "en",
    route: getMaterialLessonRoute(suffix),
    section: "material",
    userId,
  });
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
