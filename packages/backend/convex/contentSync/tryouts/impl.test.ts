import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { bulkSyncTryoutsImpl } from "@repo/backend/convex/contentSync/tryouts/impl";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const OLD_TRACK_ROUTE = "try-out/indonesia/tka/matematika-lama";
const NEW_TRACK_ROUTE = "try-out/indonesia/tka/matematika";
const STALE_CONTENT_ID = "asset:id:tryout:indonesia:tka:mathematics:stale";

describe("contentSync/tryouts/impl", () => {
  it("removes projections for a replaced catalog path", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(seedOldTrack);
    await t.mutation(async (ctx) => {
      await bulkSyncTryoutsImpl(ctx, buildPayload());
    });

    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", OLD_TRACK_ROUTE)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", OLD_TRACK_ROUTE)
        )
        .unique();
      const track = await ctx.db
        .query("tryoutTracks")
        .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
          q
            .eq("countryKey", "indonesia")
            .eq("examKey", "tka")
            .eq("trackKey", "mathematics")
            .eq("locale", "id")
        )
        .unique();

      return { route, search, track };
    });

    expect(snapshot).toEqual({
      route: null,
      search: null,
      track: expect.objectContaining({ publicPath: NEW_TRACK_ROUTE }),
    });
  });
});

/** Builds the smallest catalog payload that replaces one track path. */
function buildPayload() {
  return {
    countries: [],
    exams: [],
    questionSets: [],
    questions: [],
    routes: [],
    sections: [],
    sets: [],
    tracks: [
      {
        authoredSetCount: 1,
        countryKey: "indonesia",
        examKey: "tka",
        isActive: true,
        isReady: true,
        locale: "id" as const,
        order: 1,
        publicPath: NEW_TRACK_ROUTE,
        readyQuestionCount: 1,
        readySetCount: 1,
        readyVisibleSectionCount: 0,
        sourceRevision: "2026",
        title: "Matematika",
        trackKey: "mathematics",
        trackKind: "subject" as const,
      },
    ],
  };
}

/** Seeds the old catalog path and both projections that it owns. */
async function seedOldTrack(ctx: MutationCtx) {
  await ctx.db.insert("tryoutTracks", {
    ...buildPayload().tracks[0],
    isReady: false,
    publicPath: OLD_TRACK_ROUTE,
    syncedAt: 1,
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
}
