import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { TryoutRouteKind } from "@repo/contents/_types/tryout/schema";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const COUNTRY_ROUTE = "try-out/indonesia";
const EXAM_ROUTE = `${COUNTRY_ROUTE}/tka`;
const OLD_TRACK_ROUTE = `${EXAM_ROUTE}/mathematics`;
const NEW_TRACK_ROUTE = `${EXAM_ROUTE}/matematika`;

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
function buildPayload(trackPublicPath: string) {
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
        publicPath: trackPublicPath,
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
        publicPath: trackPublicPath,
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

/** Returns the graph identity for a test route. */
function getGraphIdentity(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity;
}

describe("contentSync/mutations/tryout projection paths", () => {
  it("updates canonical track projections when the public path changes", async () => {
    const t = convexTest(schema, convexModules);
    const oldGraph = getGraphIdentity(OLD_TRACK_ROUTE);
    const newGraph = getGraphIdentity(NEW_TRACK_ROUTE);

    expect(newGraph).toEqual(oldGraph);

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildPayload(OLD_TRACK_ROUTE)
    );
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildPayload(NEW_TRACK_ROUTE)
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
