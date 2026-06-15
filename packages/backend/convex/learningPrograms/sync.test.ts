import { api, internal } from "@repo/backend/convex/_generated/api";
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
  "subject/high-school/10/chemistry/atomic-structure"
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

    expect(result).toEqual({ created: 4, skipped: 0, updated: 0 });
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
