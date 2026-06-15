import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  getLearningProgramCatalogInputs,
  type LearningProgramSyncInput,
} from "@repo/backend/convex/learningPrograms/catalog";
import {
  getLearningOutcomeInputs,
  getOutcomeConceptAlignmentInputs,
  getProgramOutlineNodeInputs,
} from "@repo/backend/convex/learningPrograms/outcomes";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;
const subjectGraph = getGraphIdentity(
  "subject/high-school/10/chemistry/atomic-structure"
);
const replacementSubjectGraph = getGraphIdentity(
  "subject/high-school/10/chemistry/atomic-structure/electron-configuration"
);
const staleSubjectGraph = getGraphIdentity(
  "subject/high-school/10/biology/deleted-topic"
);

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
    const outcomeResult = await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramOutcomes,
      {
        conceptAlignments: getOutcomeConceptAlignmentInputs(),
        outcomes: getLearningOutcomeInputs(),
        outlineNodes: getProgramOutlineNodeInputs(),
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
    const outcomeCounts = await t.query(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "id-kurikulum-merdeka"))
        .unique();

      if (!program) {
        throw new Error("Expected synced Kurikulum Merdeka program.");
      }

      const outlineNodes = await ctx.db
        .query("learningProgramOutlineNodes")
        .withIndex("by_programId_and_parentKey_and_displayOrder", (q) =>
          q.eq("programId", program._id).eq("parentKey", undefined)
        )
        .take(10);
      const outcomes = await ctx.db
        .query("learningProgramOutcomes")
        .withIndex("by_programId_and_key", (q) =>
          q
            .eq("programId", program._id)
            .eq("key", "id.km.fase-e.math.statistics")
        )
        .take(10);
      const concepts = await ctx.db
        .query("learningProgramOutcomeConcepts")
        .withIndex("by_programId_and_outcomeKey", (q) =>
          q
            .eq("programId", program._id)
            .eq("outcomeKey", "id.km.fase-e.math.statistics")
        )
        .take(10);

      return {
        concepts: concepts.length,
        outcomes: outcomes.length,
        rootNodes: outlineNodes.length,
      };
    });

    expect(result).toEqual({ created: 4, skipped: 0, updated: 0 });
    expect(outcomeResult).toEqual({ created: 15, skipped: 0, updated: 0 });
    expect(programs.map((program) => program.key)).toEqual([
      "nakafa-stem-path",
      "id-kurikulum-merdeka",
      "snbt-2026",
    ]);
    expect(
      programs.find((program) => program.key === "id-kurikulum-merdeka")
    ).toMatchObject({
      navigation: {
        levels: ["class", "subject", "topic"],
        model: "class-subject-topic",
      },
    });
    expect(sourceCount).toBe(2);
    expect(outcomeCounts).toEqual({
      concepts: 1,
      outcomes: 1,
      rootNodes: 1,
    });
  });

  it("prunes omitted generated outcome rows without deleting program catalog rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const outlineNodes = getProgramOutlineNodeInputs();
    const outcomes = getLearningOutcomeInputs();
    const conceptAlignments = getOutcomeConceptAlignmentInputs();

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramOutcomes,
      {
        conceptAlignments,
        outcomes,
        outlineNodes,
        syncedAt: NOW,
      }
    );

    const result = await t.mutation(
      internal.learningPrograms.sync.syncLearningProgramOutcomes,
      {
        conceptAlignments: conceptAlignments.slice(0, 4),
        outcomes: outcomes.slice(0, 3),
        outlineNodes,
        syncedAt: NOW + 1,
      }
    );
    const remaining = await t.query(async (ctx) => {
      const tka = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "tka-2026"))
        .unique();
      const outcome = await ctx.db
        .query("learningProgramOutcomes")
        .withIndex("by_syncedAt", (q) => q.eq("syncedAt", NOW))
        .take(10);
      const concepts = await ctx.db
        .query("learningProgramOutcomeConcepts")
        .withIndex("by_syncedAt", (q) => q.eq("syncedAt", NOW))
        .take(10);

      return {
        oldConceptRows: concepts.length,
        oldOutcomeRows: outcome.length,
        tkaExists: Boolean(tka),
      };
    });

    expect(result).toEqual({ created: 0, skipped: 0, updated: 15 });
    expect(remaining).toEqual({
      oldConceptRows: 0,
      oldOutcomeRows: 0,
      tkaExists: true,
    });
  });

  it("lists canonical programs in each content language only after coverage exists", async () => {
    const t = createConvexTestWithBetterAuth();
    const englishSubjectGraph = getGraphIdentity(
      "subject/high-school/10/chemistry/atomic-structure",
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
      route: "subject/high-school/10/biology/deleted-topic",
      title: "Deleted Topic",
    });
    await seedContentRoute(t, {
      graph: subjectGraph,
      route: "subject/high-school/10/chemistry/atomic-structure",
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
        route: "subject/high-school/10/chemistry/atomic-structure",
        title: "Atomic Structure",
      }),
    ]);
    expect(activeProfile?.planItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: staleSubjectGraph.assetId,
          route: "subject/high-school/10/biology/deleted-topic",
          title: "Deleted Topic",
        }),
      ])
    );
  });

  it("repairs active plan items when existing coverage changes sample content", async () => {
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
      route: "subject/high-school/10/chemistry/atomic-structure",
      title: "Atomic Structure",
    });
    await seedContentRoute(t, {
      graph: replacementSubjectGraph,
      route:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
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
          "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
        title: "Electron Configuration",
      }),
    ]);
    expect(activeProfile?.planItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_id: subjectGraph.assetId,
          route: "subject/high-school/10/chemistry/atomic-structure",
          title: "Atomic Structure",
        }),
      ])
    );
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
      key: "retired-nakafa-path",
      translations: {
        en: {
          description: "Retired path.",
          title: "Retired Nakafa Path",
        },
        id: {
          description: "Jalur yang sudah dihentikan.",
          title: "Jalur Nakafa Lama",
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
        interests: ["nakafa-path"],
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

    expect(result).toEqual({ created: 0, skipped: 0, updated: 5 });
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
        kind: "subject-topic",
        locale: "id",
        markdown: true,
        route,
        section: "subject",
        syncedAt: NOW,
        title,
      })
  );
}
