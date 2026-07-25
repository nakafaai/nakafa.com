import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  getTestGraphIdentity,
  seedLearningProgramCatalog,
  seedTestContentRoute,
  syncTestGraphCoverage,
  TEST_NOW,
} from "@repo/backend/test/learning-programs";
import { describe, expect, it } from "vitest";

const subjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const englishSubjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure",
  "en"
);
const snbtGraph = getTestGraphIdentity("try-out/indonesia/snbt/2027/set-1");

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
    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.learningPreferences.queries.getCurrent, { locale: "id" })
    ).resolves.toMatchObject({
      preferredCurriculumProgramKey: "merdeka",
      program: { key: "merdeka" },
    });
  });

  it("stores unique interests and rejects unrelated primary programs", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );

    await seedLearningProgramCatalog(t);
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
