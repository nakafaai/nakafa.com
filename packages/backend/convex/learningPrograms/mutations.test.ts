import { api, internal } from "@repo/backend/convex/_generated/api";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;
const subjectGraph = getGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const englishSubjectGraph = getGraphIdentity(
  "material/lesson/chemistry/atomic-structure",
  "en"
);
const snbtGraph = getGraphIdentity(
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
);

describe("learningPrograms/mutations", () => {
  it("creates an authenticated profile and graph-backed first plan", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await seedContentRoute(t);
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

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum", "exam-prep"],
        locale: "id",
        primaryProgramKey: "id-kurikulum-merdeka",
        stage: "grade-10",
      });

    expect(result).toMatchObject({
      interests: ["school-curriculum", "exam-prep"],
      planItems: [
        {
          content_id: subjectGraph.assetId,
          route: "material/lesson/chemistry/atomic-structure",
        },
      ],
      program: { key: "id-kurikulum-merdeka" },
      stage: "grade-10",
    });
  });

  it("stores unique interests and rejects unrelated primary programs", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await syncProgramCoverage(t, {
      graph: snbtGraph,
      lensScope: "exam",
      locale: "id",
      programKey: "snbt-2026",
    });

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const result = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["exam-prep", "exam-prep"],
        locale: "id",
        primaryProgramKey: "snbt-2026",
      }
    );

    expect(result.interests).toEqual(["exam-prep"]);
    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "snbt-2026",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_INTEREST_MISMATCH");
  });

  it("selects the same canonical program from Indonesian and English UI", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });
    await syncProgramCoverage(t, {
      graph: subjectGraph,
      lensScope: "curriculum",
      locale: "id",
      programKey: "id-kurikulum-merdeka",
    });
    await syncProgramCoverage(t, {
      graph: englishSubjectGraph,
      lensScope: "curriculum",
      locale: "en",
      programKey: "id-kurikulum-merdeka",
    });

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const englishSelection = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "en",
        primaryProgramKey: "id-kurikulum-merdeka",
      }
    );
    const englishProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "en" }
    );

    expect(englishSelection.program).toMatchObject({
      key: "id-kurikulum-merdeka",
      title: "Kurikulum Merdeka",
    });
    expect(englishProfile?.program).toMatchObject({
      key: "id-kurikulum-merdeka",
      title: "Kurikulum Merdeka",
    });

    const indonesianSelection = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "id-kurikulum-merdeka",
      }
    );

    expect(indonesianSelection.program.key).toBe(englishSelection.program.key);
  });

  it("rejects selections without content-language coverage before profile writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum"],
        locale: "en",
        primaryProgramKey: "id-kurikulum-merdeka",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CONTENT_LOCALE_UNAVAILABLE");

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toBeNull();
  });

  it("rejects planned program selections before profile writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: NOW,
    });

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["assessment-prep"],
        locale: "id",
        primaryProgramKey: "tka-2026",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_NOT_SELECTABLE");

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toBeNull();
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

/** Seeds one program coverage row so locale-specific selection can proceed. */
async function syncProgramCoverage(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  {
    graph,
    lensScope,
    locale,
    programKey,
  }: {
    graph: ReturnType<typeof getGraphIdentity>;
    lensScope: "curriculum" | "exam";
    locale: "en" | "id";
    programKey: string;
  }
) {
  await t.mutation(internal.learningPrograms.sync.syncLearningProgramCoverage, {
    coverageRows: [
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: graph.lensId,
        lensScope,
        locale,
        programKey,
        sampleContentId: graph.assetId,
        syncedAt: NOW,
      },
    ],
  });
}

/** Seeds the content route used to decorate generated learning plan items. */
async function seedContentRoute(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  await t.mutation(async (ctx) => {
    await ctx.db.insert("contentRoutes", {
      ...subjectGraph,
      authors: [],
      contentHash: "chemistry-hash",
      content_id: subjectGraph.assetId,
      kind: "curriculum-topic",
      locale: "id",
      markdown: true,
      route: "material/lesson/chemistry/atomic-structure",
      section: "material",
      sourcePath: "material/lesson/chemistry/atomic-structure",
      syncedAt: NOW,
      title: "Atomic Structure",
    });
  });
}
