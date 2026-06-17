import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  getLearningProgramCatalogInputs,
  type LearningProgramSyncInput,
} from "@repo/backend/convex/learningPrograms/catalog";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;
const subjectGraph = getGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const replacementSubjectGraph = getGraphIdentity(
  "material/lesson/chemistry/atomic-structure/electron-configuration"
);
const staleSubjectGraph = getGraphIdentity(
  "material/lesson/biology/deleted-topic"
);
const POPULAR_PLAN_ITEM_COUNT = 501;
interface CoverageSampleReconcileArgs {
  lensId: string;
  locale: Doc<"learningProgramCoverage">["locale"];
  nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
  nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  previousSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  programId: Id<"learningPrograms">;
}
interface StaleCoveragePlanItemDeleteArgs {
  lensId: string;
  programId: Id<"learningPrograms">;
  sampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
}

describe("learningPrograms", () => {
  it("syncs selectable catalog rows and bounded source rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(
      internal.learningPrograms.sync.syncLearningPrograms,
      {
        programs: getLearningProgramCatalogInputs(),
        syncedAt: NOW,
      }
    );
    const programs = await t.query(
      api.learningPrograms.queries.listSelectablePrograms,
      {}
    );
    const sourceCount = await t.query(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "tka-2026"))
        .unique();

      if (!program) {
        throw new Error("Expected synced TKA program.");
      }

      const sources = await ctx.db
        .query("learningProgramSources")
        .withIndex("by_programId", (q) => q.eq("programId", program._id))
        .take(10);

      return sources.length;
    });

    expect(result).toEqual({ created: 5, skipped: 0, updated: 0 });
    expect(programs.map((program) => program.key)).toEqual([
      "id-kurikulum-merdeka",
      "snbt-2026",
    ]);
    expect(
      programs.find((program) => program.key === "id-kurikulum-merdeka")
    ).toMatchObject({
      navigation: {
        levels: ["class", "subject", "topic"],
        model: "class-curriculum-topic",
      },
    });
    expect(sourceCount).toBe(2);
  });

  it("lists canonical programs in each content language only after coverage exists", async () => {
    const t = createConvexTestWithBetterAuth();
    const englishSubjectGraph = getGraphIdentity(
      "material/lesson/chemistry/atomic-structure",
      "en"
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });

    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "en",
      })
    ).resolves.toEqual([]);

    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: englishSubjectGraph.lensId,
            lensScope: "curriculum",
            locale: "en",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: englishSubjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );

    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).resolves.toMatchObject([
      {
        key: "id-kurikulum-merdeka",
        title: "Kurikulum Merdeka",
      },
    ]);
    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "en",
      })
    ).resolves.toMatchObject([
      {
        description: "Follow Indonesia's school curriculum by class topic.",
        key: "id-kurikulum-merdeka",
      },
    ]);
  });

  it("deletes stale coverage rows in bounded batches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: "lens:subject:high-school:10:chemistry:old",
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW - 1,
          },
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );

    const result = await t.mutation(
      internal.learningPrograms.sync.deleteStaleLearningProgramCoverage,
      {
        limit: 10,
        locale: "id",
        syncedAt: NOW,
      }
    );
    const remainingCoverage = await t.query(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "id-kurikulum-merdeka"))
        .unique();

      if (!program) {
        throw new Error("Expected synced Kurikulum Merdeka program.");
      }

      return await ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programId_and_locale_and_coverageStatus", (q) =>
          q
            .eq("programId", program._id)
            .eq("locale", "id")
            .eq("coverageStatus", "partial")
        )
        .take(10);
    });

    expect(result).toEqual({ deleted: 1 });
    expect(remainingCoverage.map((row) => row.lensId)).toEqual([
      subjectGraph.lensId,
    ]);
  });

  it("removes active plan items before deleting stale coverage rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await seedContentRoute(t, {
      graph: staleSubjectGraph,
      route: "material/lesson/biology/deleted-topic",
      title: "Deleted Topic",
    });
    await seedContentRoute(t, {
      graph: subjectGraph,
      route: "material/lesson/chemistry/atomic-structure",
      title: "Atomic Structure",
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: staleSubjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: staleSubjectGraph.assetId,
            syncedAt: NOW - 1,
          },
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const createdProfile = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "id-kurikulum-merdeka",
      }
    );

    expect(createdProfile.planItems.map((item) => item.content_id)).toContain(
      staleSubjectGraph.assetId
    );

    await t.mutation(
      internal.learningPrograms.sync.deleteStaleLearningProgramCoverage,
      {
        limit: 10,
        locale: "id",
        syncedAt: NOW,
      }
    );

    const activeProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(activeProfile?.planItems).toEqual([
      expect.objectContaining({
        content_id: subjectGraph.assetId,
        route: "material/lesson/chemistry/atomic-structure",
        title: "Atomic Structure",
      }),
    ]);
    expect(activeProfile?.planItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: staleSubjectGraph.assetId,
          route: "material/lesson/biology/deleted-topic",
          title: "Deleted Topic",
        }),
      ])
    );
  });

  it("reconciles active plan items when existing coverage changes sample content", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    const staleRouteId = await seedContentRoute(t, {
      graph: subjectGraph,
      route: "material/lesson/chemistry/atomic-structure",
      title: "Atomic Structure",
    });
    await seedContentRoute(t, {
      graph: replacementSubjectGraph,
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      title: "Electron Configuration",
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const createdProfile = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "id-kurikulum-merdeka",
      }
    );

    expect(createdProfile.planItems.map((item) => item.content_id)).toEqual([
      subjectGraph.assetId,
    ]);

    await t.mutation(async (ctx) => {
      await ctx.db.delete(staleRouteId);
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: replacementSubjectGraph.assetId,
            syncedAt: NOW + 1,
          },
        ],
      }
    );

    const activeProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(activeProfile?.planItems).toEqual([
      expect.objectContaining({
        content_id: replacementSubjectGraph.assetId,
        route:
          "material/lesson/chemistry/atomic-structure/electron-configuration",
        title: "Electron Configuration",
      }),
    ]);
    expect(activeProfile?.planItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: subjectGraph.assetId,
          route: "material/lesson/chemistry/atomic-structure",
          title: "Atomic Structure",
        }),
      ])
    );
  });

  it("reconciles popular generated plan items in bounded batches when sample content changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await seedContentRoute(t, {
      graph: replacementSubjectGraph,
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      title: "Electron Configuration",
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );
    const plan = await seedGeneratedPlanItems(t, {
      contentId: subjectGraph.assetId,
      count: POPULAR_PLAN_ITEM_COUNT,
      identity,
      lensId: subjectGraph.lensId,
      lensScope: "curriculum",
      programKey: "id-kurikulum-merdeka",
    });

    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: replacementSubjectGraph.assetId,
            syncedAt: NOW + 1,
          },
        ],
      }
    );
    await drainCoverageSampleReconcile(t, {
      lensId: subjectGraph.lensId,
      locale: "id",
      nextCoverageStatus: "partial",
      nextSampleContentId: replacementSubjectGraph.assetId,
      previousSampleContentId: subjectGraph.assetId,
      programId: plan.programId,
    });

    const counts = await countPlanItemsByContent(t, {
      lensId: subjectGraph.lensId,
      nextContentId: replacementSubjectGraph.assetId,
      oldContentId: subjectGraph.assetId,
      programId: plan.programId,
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const activeProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(counts).toEqual({
      next: POPULAR_PLAN_ITEM_COUNT,
      old: 0,
    });
    expect(activeProfile?.planItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: replacementSubjectGraph.assetId,
          route:
            "material/lesson/chemistry/atomic-structure/electron-configuration",
          title: "Electron Configuration",
        }),
      ])
    );
    expect(activeProfile?.planItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: subjectGraph.assetId,
        }),
      ])
    );
  });

  it("deletes popular generated plan items in bounded batches when coverage is stale", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: staleSubjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: "id-kurikulum-merdeka",
            sampleContentId: staleSubjectGraph.assetId,
            syncedAt: NOW - 1,
          },
        ],
      }
    );
    const plan = await seedGeneratedPlanItems(t, {
      contentId: staleSubjectGraph.assetId,
      count: POPULAR_PLAN_ITEM_COUNT,
      identity,
      lensId: staleSubjectGraph.lensId,
      lensScope: "curriculum",
      programKey: "id-kurikulum-merdeka",
    });

    await t.mutation(
      internal.learningPrograms.sync.deleteStaleLearningProgramCoverage,
      {
        limit: 10,
        locale: "id",
        syncedAt: NOW,
      }
    );
    await drainStaleCoveragePlanItemDelete(t, {
      lensId: staleSubjectGraph.lensId,
      programId: plan.programId,
      sampleContentId: staleSubjectGraph.assetId,
    });

    const remaining = await countPlanItemsForContent(t, {
      contentId: staleSubjectGraph.assetId,
      lensId: staleSubjectGraph.lensId,
      programId: plan.programId,
    });
    const coverageRows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("learningProgramCoverage")
          .withIndex("by_programId_and_locale_and_lensId", (q) =>
            q
              .eq("programId", plan.programId)
              .eq("locale", "id")
              .eq("lensId", staleSubjectGraph.lensId)
          )
          .take(10)
    );

    expect(remaining).toBe(0);
    expect(coverageRows).toEqual([]);
  });

  it("hides omitted catalog rows without orphaning existing profiles", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    const catalog = getLearningProgramCatalogInputs();
    const retiredProgram = {
      ...catalog[0],
      displayOrder: 50,
      key: "retired-school-curriculum",
      translations: {
        en: {
          description: "Retired school curriculum.",
          publicSlug: "retired-school-curriculum",
          title: "Retired School Curriculum",
        },
        id: {
          description: "Kurikulum sekolah yang sudah dihentikan.",
          publicSlug: "retired-school-curriculum",
          title: "Kurikulum Sekolah Lama",
        },
      },
    } satisfies LearningProgramSyncInput;

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: [...catalog, retiredProgram],
      syncedAt: NOW,
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      {
        coverageRows: [
          {
            contentCount: 1,
            coverageStatus: "partial",
            lensId: subjectGraph.lensId,
            lensScope: "curriculum",
            locale: "id",
            programKey: retiredProgram.key,
            sampleContentId: subjectGraph.assetId,
            syncedAt: NOW,
          },
        ],
      }
    );

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: retiredProgram.key,
      }
    );

    const result = await t.mutation(
      internal.learningPrograms.sync.syncLearningPrograms,
      {
        programs: catalog,
        syncedAt: NOW + 1,
      }
    );
    const selectablePrograms = await t.query(
      api.learningPrograms.queries.listSelectablePrograms,
      { locale: "id" }
    );
    const activeProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      {}
    );

    expect(result).toEqual({ created: 0, skipped: 0, updated: 6 });
    expect(selectablePrograms.map((program) => program.key)).not.toContain(
      retiredProgram.key
    );
    expect(activeProfile?.program).toMatchObject({
      coverageStatus: "hidden",
      key: retiredProgram.key,
    });
  });

  it("rejects empty catalog batches before reconciliation", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [],
        syncedAt: NOW,
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CATALOG_EMPTY");
  });

  it("rejects source lists beyond the bounded replacement contract", async () => {
    const t = createConvexTestWithBetterAuth();
    const [program] = getLearningProgramCatalogInputs();
    const sources = Array.from({ length: 21 }, (_, index) => ({
      label: `Source ${index}`,
      retrievedAt: "2026-06-14",
      type: "nakafa-editorial",
      url: `https://nakafa.com/source-${index}`,
    })) satisfies typeof program.sources;

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [{ ...program, sources }],
        syncedAt: NOW,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("rejects invalid registry date strings before writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const [program] = getLearningProgramCatalogInputs();

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [
          {
            ...program,
            sources: [
              {
                ...program.sources[0],
                retrievedAt: "not-a-date",
              },
            ],
          },
        ],
        syncedAt: NOW,
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CATALOG_INVALID");
  });
});

/** Returns graph identity for a route fixture and fails fast on invalid fixtures. */
function getGraphIdentity(route: string, locale: "en" | "id" = "id") {
  const identity = createLearningGraphIdentityFromRoute({
    locale,
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity;
}

/** Seeds one content route projection so generated plan items can carry route copy. */
async function seedContentRoute(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  {
    graph,
    route,
    title,
  }: {
    graph: ReturnType<typeof getGraphIdentity>;
    route: string;
    title: string;
  }
) {
  return await t.mutation(
    async (ctx) =>
      await ctx.db.insert("contentRoutes", {
        ...graph,
        authors: [],
        contentHash: `${graph.assetId}-hash`,
        content_id: graph.assetId,
        kind: "curriculum-topic",
        locale: "id",
        markdown: true,
        route,
        section: "material",
        sourcePath: route,
        syncedAt: NOW,
        title,
      })
  );
}

/** Seeds generated learning-plan rows directly for sync reconcile regression tests. */
async function seedGeneratedPlanItems(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  {
    contentId,
    count,
    identity,
    lensId,
    lensScope,
    programKey,
  }: {
    contentId: string;
    count: number;
    identity: Awaited<ReturnType<typeof seedAuthenticatedUser>>;
    lensId: string;
    lensScope: Doc<"learningProgramCoverage">["lensScope"];
    programKey: string;
  }
) {
  return await t.mutation(async (ctx) => {
    const program = await ctx.db
      .query("learningPrograms")
      .withIndex("by_key", (q) => q.eq("key", programKey))
      .unique();

    if (!program) {
      throw new Error(`Expected synced program ${programKey}.`);
    }

    const profileId = await ctx.db.insert("learningProfiles", {
      interests: ["school-curriculum"],
      programId: program._id,
      updatedAt: NOW,
      userId: identity.userId,
    });
    const planId = await ctx.db.insert("learningPlans", {
      createdAt: NOW,
      profileId,
      programId: program._id,
      status: "active",
      updatedAt: NOW,
      userId: identity.userId,
      version: 1,
    });

    await ctx.db.patch(profileId, {
      activePlanId: planId,
    });

    for (let index = 0; index < count; index++) {
      await ctx.db.insert("learningPlanItems", {
        content_id: contentId,
        coverageStatus: "partial",
        createdAt: NOW,
        lensId,
        lensScope,
        planId,
        position: index + 1,
        programId: program._id,
        reason: "program-alignment",
        route: `fixture/old-${index + 1}`,
        status: "ready",
        title: `Old Item ${index + 1}`,
        updatedAt: NOW,
        userId: identity.userId,
      });
    }

    return { planId, programId: program._id, profileId };
  });
}

/** Continues sample-change reconcile until no rows point at the old sample. */
async function drainCoverageSampleReconcile(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  args: CoverageSampleReconcileArgs
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining = await countPlanItemsForContent(t, {
      contentId: args.previousSampleContentId,
      lensId: args.lensId,
      programId: args.programId,
    });

    if (remaining === 0) {
      return;
    }

    await t.mutation(
      internal.learningPrograms.sync.continueCoverageSamplePlanItemReconcile,
      args
    );
  }

  throw new Error("Expected generated plan item sample reconcile to drain.");
}

/** Continues stale-coverage deletion until no rows point at the removed sample. */
async function drainStaleCoveragePlanItemDelete(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  args: StaleCoveragePlanItemDeleteArgs
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining = await countPlanItemsForContent(t, {
      contentId: args.sampleContentId,
      lensId: args.lensId,
      programId: args.programId,
    });

    if (remaining === 0) {
      return;
    }

    await t.mutation(
      internal.learningPrograms.sync.continueStaleCoveragePlanItemDelete,
      args
    );
  }

  throw new Error("Expected generated plan item stale delete to drain.");
}

/** Counts generated plan rows for one content sample. */
async function countPlanItemsForContent(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  {
    contentId,
    lensId,
    programId,
  }: {
    contentId: string;
    lensId: string;
    programId: Awaited<ReturnType<typeof seedGeneratedPlanItems>>["programId"];
  }
) {
  return await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("learningPlanItems")
      .withIndex("by_programId_and_lensId_and_content_id", (q) =>
        q
          .eq("programId", programId)
          .eq("lensId", lensId)
          .eq("content_id", contentId)
      )
      .take(POPULAR_PLAN_ITEM_COUNT + 1);

    return rows.length;
  });
}

/** Counts old and replacement generated plan rows for one reconcile assertion. */
async function countPlanItemsByContent(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  {
    lensId,
    nextContentId,
    oldContentId,
    programId,
  }: {
    lensId: string;
    nextContentId: string;
    oldContentId: string;
    programId: Awaited<ReturnType<typeof seedGeneratedPlanItems>>["programId"];
  }
) {
  const old = await countPlanItemsForContent(t, {
    contentId: oldContentId,
    lensId,
    programId,
  });
  const next = await countPlanItemsForContent(t, {
    contentId: nextContentId,
    lensId,
    programId,
  });

  return { next, old };
}
