import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import type { RecordContentViewArgs } from "@repo/backend/convex/contents/views/spec";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { expect } from "vitest";

export const CONTENT_VIEW_NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
export const ARTICLE_VIEW_ROUTE = "articles/politics/views";
export const ARTICLE_VIEW_ID = "asset:id:catalog:article:views";
export const SUBJECT_VIEW_ROUTE = "material/lesson/mathematics/vector/addition";
export const SUBJECT_VIEW_ID = "asset:id:catalog:subject:views";
export const TRYOUT_VIEW_ROUTE = "try-out/indonesia/snbt/2027/set-1";
export const TRYOUT_VIEW_ID = "asset:id:catalog:tryout-set:views";
export const canonicalViewContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/** Builds one canonical article-view mutation input. */
export function makeArticleViewArgs(
  contentId: string,
  deviceId: string
): RecordContentViewArgs {
  return {
    contentId,
    deviceId,
    locale: "id",
    publicPath: ARTICLE_VIEW_ROUTE,
    section: "articles",
  };
}

/** Builds one route-catalog graph fixture from the route shape under test. */
function getGraphFixture(route: string) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!graph) {
    expect.fail(`Unable to build graph fixture for route "${route}".`);
  }

  return graph;
}

/** Inserts one graph route-catalog row for content-view tests. */
export async function insertContentViewRoute(
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
    syncedAt: CONTENT_VIEW_NOW,
    title: source.title,
  });

  return source.contentId;
}

/** Inserts one source-owned article and its route projection. */
export async function insertContentViewArticle(
  ctx: MutationCtx,
  slug = ARTICLE_VIEW_ROUTE,
  contentId = ARTICLE_VIEW_ID
) {
  const id = await ctx.db.insert("articleContents", {
    articleSlug: slug.split("/").at(-1) ?? "views",
    body: "Article body",
    category: "politics",
    contentHash: `hash-${slug}`,
    date: CONTENT_VIEW_NOW,
    description: "Article description",
    locale: "id",
    slug,
    syncedAt: CONTENT_VIEW_NOW,
    title: "Views",
  });

  await insertContentViewRoute(ctx, {
    contentId,
    kind: "article",
    route: slug,
    section: "articles",
    title: "Views",
  });

  return { contentId, id };
}

/** Inserts one source-owned curriculum lesson and its route projection. */
export async function insertContentViewSubject(ctx: MutationCtx) {
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: "id",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: "material/lesson/mathematics/vector",
    syncedAt: CONTENT_VIEW_NOW,
    title: "Vector",
    topic: "vector",
  });

  const id = await ctx.db.insert("curriculumLessons", {
    body: "Subject body",
    contentHash: "subject-hash",
    date: CONTENT_VIEW_NOW,
    description: "Subject description",
    locale: "id",
    material: "mathematics",
    order: 0,
    section: "addition",
    slug: SUBJECT_VIEW_ROUTE,
    subject: "Vector",
    syncedAt: CONTENT_VIEW_NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });

  await insertContentViewRoute(ctx, {
    contentId: SUBJECT_VIEW_ID,
    kind: "curriculum-lesson",
    route: SUBJECT_VIEW_ROUTE,
    section: "material",
    title: "Vector Addition",
  });

  return { contentId: SUBJECT_VIEW_ID, id };
}

/** Inserts one source-owned try-out set route projection. */
export async function insertContentViewTryout(ctx: MutationCtx) {
  await insertContentViewRoute(ctx, {
    contentId: TRYOUT_VIEW_ID,
    kind: "tryout-set",
    route: TRYOUT_VIEW_ROUTE,
    section: "tryout",
    title: "SNBT Set 1",
  });

  return { contentId: TRYOUT_VIEW_ID };
}

/** Returns the analytics partition for one popularity signal scope. */
export function getContentViewPartition(contentId: string) {
  return getContentAnalyticsPartition(`${contentId}:global:canonical`);
}

/** Returns whether one scheduled job is the analytics partition scheduler. */
function isAnalyticsPartitionJob(job: { args: readonly unknown[] }) {
  const [arg] = job.args;

  return typeof arg === "object" && arg !== null && "partition" in arg;
}

/** Returns whether one scheduled job is a content-view product event. */
function isContentViewedEventJob(job: { args: readonly unknown[] }) {
  const [arg] = job.args;

  if (typeof arg !== "object" || arg === null) {
    return false;
  }

  return Reflect.get(arg, "event") === "content viewed";
}

/** Reads the product analytics user from a scheduled content-view event. */
export function getContentViewDistinctId(job: { args: readonly unknown[] }) {
  const [arg] = job.args;

  if (typeof arg !== "object" || arg === null) {
    expect.fail("Expected scheduled content-view event arguments.");
  }

  const distinctId = Reflect.get(arg, "distinctId");
  if (typeof distinctId !== "string") {
    expect.fail("Expected scheduled content-view event distinct ID.");
  }

  return distinctId;
}

/** Reads the bounded content-view state owned by one test fixture. */
export async function readContentViewState(
  target: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  return await target.query(async (ctx) => {
    const scheduledFunctions = await ctx.db.system
      .query("_scheduled_functions")
      .take(20);

    return {
      contentViewEvents: scheduledFunctions.filter(isContentViewedEventJob),
      engagementQueue: await ctx.db.query("learningEngagementQueue").take(20),
      recents: await ctx.db.query("userLearningRecents").take(20),
      scheduledJobs: scheduledFunctions.filter(isAnalyticsPartitionJob),
      viewerSignals: await ctx.db
        .query("learningPopularityViewerSignals")
        .take(20),
      views: await ctx.db.query("learningViews").take(20),
    };
  });
}
