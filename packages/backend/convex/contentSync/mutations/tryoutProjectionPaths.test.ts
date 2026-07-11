import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { TryoutRouteKind } from "@repo/contents/_types/tryout/schema";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const COUNTRY_ROUTE = "try-out/indonesia";
const EXAM_ROUTE = `${COUNTRY_ROUTE}/tka`;
const OLD_TRACK_ROUTE = `${EXAM_ROUTE}/matematika-lama`;
const NEW_TRACK_ROUTE = `${EXAM_ROUTE}/matematika`;
const STALE_CONTENT_ID = "asset:id:tryout:indonesia:tka:mathematics:stale";

/** Builds one route projection fixture matching try-out source routes. */
function buildRoute(source: {
  kind: TryoutRouteKind;
  publicPath: string;
  title: string;
}) {
  return {
    contentHash: `${source.publicPath}:hash`,
    kind: source.kind,
    locale: "id" as const,
    publicPath: source.publicPath,
    sourcePath: source.publicPath,
    title: source.title,
  };
}

/** Builds the minimal catalog payload needed to replace one track path. */
function buildPayload() {
  return {
    countries: [
      {
        countryKey: "indonesia",
        isActive: true,
        locale: "id" as const,
        order: 1,
        publicPath: COUNTRY_ROUTE,
        sourceRevision: "2026",
        title: "Indonesia",
      },
    ],
    exams: [
      {
        countryKey: "indonesia",
        examKey: "tka",
        isActive: true,
        locale: "id" as const,
        order: 1,
        publicPath: EXAM_ROUTE,
        scoringStrategy: "raw" as const,
        sourceRevision: "2026",
        title: "TKA",
      },
    ],
    questionSets: [],
    questions: [],
    routes: [
      buildRoute({
        kind: "tryout-country",
        publicPath: COUNTRY_ROUTE,
        title: "Indonesia",
      }),
      buildRoute({
        kind: "tryout-exam",
        publicPath: EXAM_ROUTE,
        title: "TKA",
      }),
      buildRoute({
        kind: "tryout-track",
        publicPath: NEW_TRACK_ROUTE,
        title: "Matematika",
      }),
    ],
    sections: [],
    sets: [],
    tracks: [
      {
        authoredSetCount: 0,
        countryKey: "indonesia",
        examKey: "tka",
        isActive: true,
        isReady: false,
        locale: "id" as const,
        order: 1,
        publicPath: NEW_TRACK_ROUTE,
        readyQuestionCount: 0,
        readySetCount: 0,
        readyVisibleSectionCount: 0,
        sourceRevision: "2026",
        title: "Matematika",
        trackKey: "mathematics",
        trackKind: "subject" as const,
      },
    ],
  };
}

/** Returns the graph identity for the canonical track route. */
function getGraphIdentity() {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: NEW_TRACK_ROUTE,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${NEW_TRACK_ROUTE}.`);
  }

  return identity;
}

/** Seeds one stale catalog path and its detached read-model projections. */
async function seedStaleTrackPath(t: ReturnType<typeof convexTest>) {
  await t.mutation(async (ctx) => {
    await ctx.db.insert("tryoutTracks", {
      authoredSetCount: 0,
      countryKey: "indonesia",
      examKey: "tka",
      isActive: true,
      isReady: false,
      locale: "id",
      order: 1,
      publicPath: OLD_TRACK_ROUTE,
      readyQuestionCount: 0,
      readySetCount: 0,
      readyVisibleSectionCount: 0,
      sourceRevision: "2026",
      syncedAt: 1,
      title: "Matematika",
      trackKey: "mathematics",
      trackKind: "subject",
    });
    await ctx.db.insert("contentRoutes", {
      alignmentId: `${STALE_CONTENT_ID}:alignment`,
      assetId: STALE_CONTENT_ID,
      authors: [],
      conceptId: `${STALE_CONTENT_ID}:concept`,
      contentHash: "stale-route-hash",
      content_id: STALE_CONTENT_ID,
      kind: "tryout-track",
      learningObjectId: `${STALE_CONTENT_ID}:learning-object`,
      lensId: `${STALE_CONTENT_ID}:lens`,
      locale: "id",
      markdown: false,
      route: OLD_TRACK_ROUTE,
      section: "tryout",
      sourcePath: OLD_TRACK_ROUTE,
      syncedAt: 1,
      title: "Matematika",
    });
    await ctx.db.insert("contentSearch", {
      alignmentId: `${STALE_CONTENT_ID}:alignment`,
      assetId: STALE_CONTENT_ID,
      conceptId: `${STALE_CONTENT_ID}:concept`,
      contentHash: "stale-search-hash",
      content_id: STALE_CONTENT_ID,
      description: "",
      learningObjectId: `${STALE_CONTENT_ID}:learning-object`,
      lensId: `${STALE_CONTENT_ID}:lens`,
      locale: "id",
      markdown_url: `https://nakafa.com/id/${OLD_TRACK_ROUTE}.md`,
      route: OLD_TRACK_ROUTE,
      section: "tryout",
      sourcePath: OLD_TRACK_ROUTE,
      syncedAt: 1,
      text: "Matematika",
      title: "Matematika",
      url: `https://nakafa.com/id/${OLD_TRACK_ROUTE}`,
    });
  });
}

describe("contentSync/mutations/tryout projection paths", () => {
  it("deletes stale projections when the canonical track path changes", async () => {
    const t = convexTest(schema, convexModules);
    const newGraph = getGraphIdentity();

    await seedStaleTrackPath(t);
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildPayload()
    );

    const snapshot = await t.query(async (ctx) => {
      const oldRoutes = await ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", OLD_TRACK_ROUTE)
        )
        .take(2);
      const oldSearchRows = await ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", OLD_TRACK_ROUTE)
        )
        .take(2);
      const currentRoute = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", newGraph.assetId))
        .unique();
      const currentSearch = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) => q.eq("content_id", newGraph.assetId))
        .unique();
      const routeCount = await ctx.db
        .query("contentRouteCounts")
        .withIndex("by_locale_and_section", (q) =>
          q.eq("locale", "id").eq("section", "tryout")
        )
        .unique();
      const track = await ctx.db
        .query("tryoutTracks")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", NEW_TRACK_ROUTE)
        )
        .unique();

      return {
        currentRoute,
        currentSearch,
        oldRoutes,
        oldSearchRows,
        routeCount,
        track,
      };
    });

    expect(snapshot.oldRoutes).toEqual([]);
    expect(snapshot.oldSearchRows).toEqual([]);
    expect(snapshot.currentRoute).toMatchObject({
      route: NEW_TRACK_ROUTE,
      sourcePath: NEW_TRACK_ROUTE,
      title: "Matematika",
    });
    expect(snapshot.currentSearch).toMatchObject({
      route: NEW_TRACK_ROUTE,
      sourcePath: NEW_TRACK_ROUTE,
      title: "Matematika",
    });
    expect(snapshot.routeCount?.count).toBe(3);
    expect(snapshot.track).toMatchObject({
      publicPath: NEW_TRACK_ROUTE,
      trackKey: "mathematics",
    });
  });
});
