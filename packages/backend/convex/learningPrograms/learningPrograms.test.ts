import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type {
  LearningProgram,
  LearningProgramCoverageInput,
} from "@repo/contents/_types/program/schema";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;
const subjectGraph = getGraphIdentity(
  "subject/high-school/10/chemistry/atomic-structure"
);
const syncLearningProgramsRef = makeFunctionReference<
  "mutation",
  { programs: LearningProgram[]; syncedAt: number },
  { created: number; skipped: number; updated: number }
>("learningPrograms/sync:syncLearningPrograms");
const syncLearningProgramCoverageRef = makeFunctionReference<
  "mutation",
  { coverageRows: LearningProgramCoverageInput[] },
  { created: number; skipped: number; updated: number }
>("learningPrograms/sync:syncLearningProgramCoverage");
const listSelectableProgramsRef = makeFunctionReference<
  "query",
  { locale?: "en" | "id" },
  Array<{ key: string; kind: string; title: string }>
>("learningPrograms/queries:listSelectablePrograms");
const selectLearningProgramRef = makeFunctionReference<
  "mutation",
  {
    locale: "en" | "id";
    objective: "school-curriculum";
    programKey: string;
    stage?: string;
  },
  {
    planItems: Array<{ content_id: string; route?: string }>;
    program: { key: string };
  } | null
>("learningPrograms/mutations:selectLearningProgram");

describe("learningPrograms", () => {
  it("syncs selectable catalog rows and bounded source rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(syncLearningProgramsRef, {
      programs: [...LEARNING_PROGRAM_CATALOG],
      syncedAt: NOW,
    });
    const programs = await t.query(listSelectableProgramsRef, { locale: "id" });
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
      "tka-2026",
      "snbt-2026",
    ]);
    expect(sourceCount).toBe(2);
  });

  it("rejects source lists beyond the bounded replacement contract", async () => {
    const t = createConvexTestWithBetterAuth();
    const [program] = LEARNING_PROGRAM_CATALOG;
    const sources = Array.from({ length: 21 }, (_, index) => ({
      label: `Source ${index}`,
      retrievedAt: "2026-06-14",
      type: "nakafa-editorial" as const,
      url: `https://nakafa.com/source-${index}`,
    }));

    await expect(
      t.mutation(syncLearningProgramsRef, {
        programs: [{ ...program, sources }],
        syncedAt: NOW,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("creates an authenticated profile and graph-backed first plan", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await t.mutation(syncLearningProgramsRef, {
      programs: [...LEARNING_PROGRAM_CATALOG],
      syncedAt: NOW,
    });
    await seedContentRoute(t);
    await t.mutation(syncLearningProgramCoverageRef, {
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
    });

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(selectLearningProgramRef, {
        locale: "id",
        objective: "school-curriculum",
        programKey: "id-kurikulum-merdeka",
        stage: "grade-10",
      });

    expect(result).toMatchObject({
      planItems: [
        {
          content_id: subjectGraph.assetId,
          route: "subject/high-school/10/chemistry/atomic-structure",
        },
      ],
      program: { key: "id-kurikulum-merdeka" },
    });
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
