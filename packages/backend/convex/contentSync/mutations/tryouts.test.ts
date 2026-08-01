import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import {
  buildInternalEntryPayload,
  buildQuestions,
  buildSyncPayload,
  SECTION_GRAPH,
  SECTION_ROUTE,
  SECTION_SOURCE,
  SET_ROUTE,
} from "@repo/backend/test/tryout-sync";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentSync/mutations/tryouts", () => {
  it("syncs try-out catalog routes with readable search projections", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();

      return { route, search };
    });

    expect(result).toEqual({ created: 6, unchanged: 0, updated: 0 });
    expect(snapshot.route).toMatchObject({
      contentHash: `${SECTION_ROUTE}:hash`,
      kind: "tryout-section",
      markdown: false,
      route: SECTION_ROUTE,
      section: "tryout",
      sourcePath: SECTION_ROUTE,
      title: "Penalaran Matematika",
    });
    expect(snapshot.search).toMatchObject({
      contentHash: `${SECTION_ROUTE}:hash`,
      route: SECTION_ROUTE,
      section: "tryout",
      sourcePath: SECTION_ROUTE,
      title: "Penalaran Matematika",
    });
    expect(snapshot.search?.text).toContain("Penalaran Matematika");
    expect(snapshot.search?.text).toContain(SECTION_ROUTE);
  });

  it("deletes stale try-out sections before their question sets", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    const ids = await t.query(async (ctx) => {
      const section = await ctx.db
        .query("tryoutSections")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SECTION_ROUTE)
        )
        .unique();
      const questionSet = await ctx.db
        .query("questionSets")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", "id").eq("sourcePath", SECTION_SOURCE)
        )
        .unique();

      if (!(section && questionSet)) {
        throw new Error("Expected synced try-out section and question set.");
      }

      return {
        questionSetId: questionSet._id,
        sectionId: section._id,
      };
    });

    const sectionResult = await t.mutation(
      internal.contentSync.mutations.tryouts.deleteStaleTryoutSections,
      { sectionIds: [ids.sectionId] }
    );
    const questionSetResult = await t.mutation(
      internal.contentSync.mutations.tryouts.deleteStaleQuestionSets,
      { questionSetIds: [ids.questionSetId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const section: Doc<"tryoutSections"> | null = await ctx.db.get(
        ids.sectionId
      );
      const questionSet: Doc<"questionSets"> | null = await ctx.db.get(
        ids.questionSetId
      );

      return { questionSet, route, search, section };
    });

    expect(sectionResult).toEqual({ deleted: 1 });
    expect(questionSetResult).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      questionSet: null,
      route: null,
      search: null,
      section: null,
    });
  });

  it("deletes stale section projections when a section becomes internal-entry", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildSyncPayload()
    );
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      buildInternalEntryPayload()
    );
    const snapshot = await t.query(async (ctx) => {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", SECTION_GRAPH.assetId)
        )
        .unique();
      const set = await ctx.db
        .query("tryoutSets")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SET_ROUTE)
        )
        .unique();

      if (!set) {
        throw new Error("Expected synced try-out set.");
      }

      const section = await ctx.db
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_sectionKey", (q) =>
          q.eq("tryoutSetId", set._id).eq("sectionKey", "penalaran-matematika")
        )
        .unique();

      return { route, search, section };
    });

    expect(snapshot.route).toBeNull();
    expect(snapshot.search).toBeNull();
    expect(snapshot.section).toMatchObject({
      visibility: "internal-entry",
    });
    expect(snapshot.section).not.toHaveProperty("description");
    expect(snapshot.section).not.toHaveProperty("publicPath");
  });

  it("provisions one source-snapshot IRT scale for synced questions", async () => {
    const t = convexTest(schema, convexModules);
    const payload = {
      ...buildSyncPayload(),
      questions: buildQuestions(),
    };

    const firstResult = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );
    const secondResult = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );
    const snapshot = await t.query(async (ctx) => {
      const set = await ctx.db
        .query("tryoutSets")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", "id").eq("publicPath", SET_ROUTE)
        )
        .unique();

      if (!set) {
        throw new Error("Expected synced try-out set.");
      }

      const scales = await ctx.db
        .query("irtScaleVersions")
        .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
          q.eq("tryoutSetId", set._id)
        )
        .take(2);

      if (scales.length !== 1) {
        return { itemCount: 0, scales };
      }

      const items = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
          q.eq("scaleVersionId", scales[0]._id)
        )
        .take(21);

      return { itemCount: items.length, scales };
    });

    expect(firstResult).toEqual({ created: 26, unchanged: 0, updated: 0 });
    expect(secondResult).toEqual({ created: 0, unchanged: 26, updated: 0 });
    expect(snapshot.scales).toHaveLength(1);
    expect(snapshot.scales[0]).toMatchObject({
      model: "2pl",
      questionCount: 20,
      status: "provisional",
    });
    expect(snapshot.itemCount).toBe(20);
  });

  it("stops provisioning legacy IRT scales after signed ownership activates", async () => {
    const t = convexTest(schema, convexModules);
    const payload = {
      ...buildSyncPayload(),
      questions: buildQuestions(),
    };
    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );
    await t.mutation(async (ctx) => {
      for (const item of await ctx.db.query("irtScaleItems").collect()) {
        await ctx.db.delete(item._id);
      }
      for (const scale of await ctx.db.query("irtScaleVersions").collect()) {
        await ctx.db.delete(scale._id);
      }
    });
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      payload
    );

    await expect(
      t.query((ctx) => ctx.db.query("irtScaleVersions").collect())
    ).resolves.toEqual([]);
  });
});
