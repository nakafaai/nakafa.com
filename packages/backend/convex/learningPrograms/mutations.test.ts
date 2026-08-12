import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content-material";
import {
  getTestGraphIdentity,
  seedLearningProgramCatalog,
  seedTestContentRoute,
  syncTestCoverage,
  syncTestGraphCoverage,
  TEST_NOW,
} from "@repo/backend/test/learning-programs";
import {
  activateMaterialCatalog,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { testTryoutGraph } from "@repo/backend/test/tryouts";
import { describe, expect, it } from "vitest";

const subjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const englishSubjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure",
  "en"
);
const snbtGraph = testTryoutGraph({
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  setKey: "set-1",
  trackKey: "2027",
});

describe("learningPrograms/mutations", () => {
  it("creates an authenticated profile and graph-backed first plan", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);
    await seedTestContentRoute(t, {
      graph: subjectGraph,
      route: "material/lesson/chemistry/atomic-structure",
      title: "Atomic Structure",
    });
    await syncTestGraphCoverage(t, {
      graph: subjectGraph,
      lensScope: "curriculum",
      locale: "id",
      programKey: "merdeka",
    });

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum", "exam-prep"],
        locale: "id",
        primaryProgramKey: "merdeka",
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
      program: { key: "merdeka" },
      stage: "grade-10",
    });
    const persistedKeys = await t.query(async (ctx) =>
      (
        await Promise.all([
          ctx.db.query("learningProfiles").first(),
          ctx.db.query("learningPlans").first(),
          ctx.db.query("learningPlanItems").first(),
        ])
      ).map((row) => row?.programKey)
    );

    expect(persistedKeys).toEqual(Array.from({ length: 3 }, () => "merdeka"));
    const preference = await t.query((ctx) =>
      ctx.db
        .query("learningPreferences")
        .withIndex("by_userId", (query) => query.eq("userId", identity.userId))
        .unique()
    );
    expect(preference).toMatchObject({
      learningInterest: "school-curriculum",
      primaryProgramKey: "merdeka",
      preferredCurriculumProgramKey: "merdeka",
    });
  });

  it("keeps generated plan items on the active exact material route", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    await seedLearningProgramCatalog(t);
    await activateMaterialCatalog(t, [FUNCTION_MATERIAL]);
    await selectExactMaterial(t, FUNCTION_MATERIAL);
    await syncTestGraphCoverage(t, {
      graph: FUNCTION_MATERIAL.graph,
      lensScope: "curriculum",
      locale: "en",
      programKey: "merdeka",
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const selected = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "en",
        primaryProgramKey: "merdeka",
      }
    );
    await syncTestCoverage(t, [
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: FUNCTION_MATERIAL.graph.lensId,
        lensScope: "curriculum",
        locale: "en",
        programKey: "merdeka",
        sampleContentId: FUNCTION_MATERIAL.graph.assetId,
        syncedAt: TEST_NOW + 1,
      },
    ]);
    const refreshed = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "en" }
    );

    expect(selected.planItems).toEqual([
      expect.objectContaining({
        content_id: FUNCTION_MATERIAL.graph.assetId,
        route: FUNCTION_MATERIAL.publicPath,
        title: FUNCTION_MATERIAL.metadata.title,
      }),
    ]);
    expect(refreshed?.planItems).toEqual(selected.planItems);
  });

  it("stores unique interests and rejects unrelated primary programs", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);
    await seedTestContentRoute(t, {
      graph: snbtGraph,
      kind: "tryout-set",
      route: "try-out/indonesia/snbt/2027/set-1",
      section: "tryout",
      title: "SNBT Set 1",
    });
    await syncTestGraphCoverage(t, {
      graph: snbtGraph,
      lensScope: "exam",
      locale: "id",
      programKey: "snbt",
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
        primaryProgramKey: "snbt",
      }
    );

    expect(result.interests).toEqual(["exam-prep"]);
    expect(result.planItems).toEqual([
      expect.objectContaining({
        content_id: snbtGraph.assetId,
        route: "try-out/indonesia/snbt/2027/set-1",
        title: "SNBT Set 1",
      }),
    ]);
    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "snbt",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_INTEREST_MISMATCH");
  });

  it("selects the same canonical program from Indonesian and English UI", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);
    await syncTestGraphCoverage(t, {
      graph: subjectGraph,
      lensScope: "curriculum",
      locale: "id",
      programKey: "merdeka",
    });
    await syncTestGraphCoverage(t, {
      graph: englishSubjectGraph,
      lensScope: "curriculum",
      locale: "en",
      programKey: "merdeka",
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
        primaryProgramKey: "merdeka",
      }
    );
    const englishProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "en" }
    );

    expect(englishSelection.program).toMatchObject({
      key: "merdeka",
      title: "Kurikulum Merdeka",
    });
    expect(englishProfile?.program).toMatchObject({
      key: "merdeka",
      title: "Kurikulum Merdeka",
    });

    const indonesianSelection = await authed.mutation(
      api.learningPrograms.mutations.selectLearningProgram,
      {
        interests: ["school-curriculum"],
        locale: "id",
        primaryProgramKey: "merdeka",
      }
    );

    expect(indonesianSelection.program.key).toBe(englishSelection.program.key);
  });

  it("rejects selections without content-language coverage before profile writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["school-curriculum"],
        locale: "en",
        primaryProgramKey: "merdeka",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CONTENT_LOCALE_UNAVAILABLE");

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toBeNull();
  });

  it("rejects planned program selections before profile writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectLearningProgram, {
        interests: ["assessment-prep"],
        locale: "id",
        primaryProgramKey: "tka",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_NOT_SELECTABLE");

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toBeNull();
  });
});
