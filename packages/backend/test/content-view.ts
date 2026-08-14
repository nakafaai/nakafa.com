import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { LearningContextStorage } from "@repo/backend/convex/contents/context";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import type { RecordContentViewArgs } from "@repo/backend/convex/contents/views/spec";
import {
  type createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { expect } from "vitest";

const ARTICLE_VIEW_PROJECTION = testArticleProjection(0);

export const CONTENT_VIEW_NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
export const ARTICLE_VIEW_ROUTE = ARTICLE_VIEW_PROJECTION.publicPath;
export const ARTICLE_VIEW_ID = ARTICLE_VIEW_PROJECTION.graph.assetId;
export const canonicalViewContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} satisfies Pick<LearningContextStorage, "contextKey" | "contextMode">;

/** Builds one canonical article-view mutation input. */
export function makeArticleViewArgs(
  contentId: string,
  deviceId: string
): RecordContentViewArgs {
  return {
    contentId,
    deviceId,
    locale: "en",
    publicPath: ARTICLE_VIEW_ROUTE,
    section: "articles",
  };
}

/** Inserts one current signed article for content-view behavior tests. */
export async function insertContentViewArticle(ctx: MutationCtx) {
  await insertRuntimeArticles(ctx, 1, () => ARTICLE_VIEW_PROJECTION);
  const row = await ctx.db
    .query("articleCatalog")
    .withIndex("by_contentKey_and_appLocale", (query) =>
      query
        .eq("contentKey", ARTICLE_VIEW_PROJECTION.contentKey)
        .eq("appLocale", ARTICLE_VIEW_PROJECTION.appLocale)
    )
    .unique();
  if (!row) {
    throw new Error("Expected one current signed article fixture.");
  }
  return { contentId: ARTICLE_VIEW_ID, id: row._id };
}

/** Seeds one article and authenticated viewer for content-view behavior tests. */
export async function seedArticleViewer(ctx: MutationCtx, suffix: string) {
  const article = await insertContentViewArticle(ctx);
  const user = await seedAuthenticatedUser(ctx, {
    now: CONTENT_VIEW_NOW,
    suffix,
  });
  return { ...user, contentId: article.contentId };
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
