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
  "subject/high-school/10/chemistry/atomic-structure"
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
          route: "subject/high-school/10/chemistry/atomic-structure",
        },
      ],
      program: { key: "id-kurikulum-merdeka" },
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

  it("rejects cross-locale program selections before profile writes", async () => {
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
    ).rejects.toThrow("LEARNING_PROGRAM_LOCALE_MISMATCH");

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toBeNull();
  });
});

/** Returns graph identity for a route fixture and fails fast on invalid fixtures. */
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
      kind: "subject-topic",
      locale: "id",
      markdown: true,
      route: "subject/high-school/10/chemistry/atomic-structure",
      section: "subject",
      syncedAt: NOW,
      title: "Atomic Structure",
    });
  });
}
