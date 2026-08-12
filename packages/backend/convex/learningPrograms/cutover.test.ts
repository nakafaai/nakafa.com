import { runToCompletion } from "@convex-dev/migrations";
import migrationsTest from "@convex-dev/migrations/test";
import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NOW = 1_799_020_800_000;

describe("learningPrograms/cutover", () => {
  it("dry-runs and migrates every grounded legacy selection idempotently", async () => {
    const merdeka = makeSelectableProgram(1, "merdeka", "school-curriculum");
    const snbt = makeSelectableProgram(2, "snbt", "admission-exam");
    const data = await Effect.runPromise(
      makeProgramSnapshotData([merdeka, snbt])
    );
    const t = convexTest(schema, convexModules);
    migrationsTest.register(t);
    await activateProgramSnapshot(t, data);

    await t.mutation(async (ctx) => {
      const currentSchool = await insertLegacyProgram(
        ctx,
        "merdeka",
        "school-curriculum"
      );
      const orphanSchool = await insertLegacyProgram(
        ctx,
        "id-kurikulum-merdeka",
        "school-curriculum"
      );
      const currentExam = await insertLegacyProgram(
        ctx,
        "snbt",
        "admission-exam"
      );
      const orphanAssessment = await insertLegacyProgram(
        ctx,
        "legacy-assessment",
        "assessment"
      );

      await insertLegacyProfile(ctx, {
        interest: "school-curriculum",
        programId: currentSchool,
        suffix: "current-school",
      });
      await insertLegacyProfile(ctx, {
        interest: "school-curriculum",
        preferredCurriculumProgramKey: "merdeka",
        programId: orphanSchool,
        suffix: "orphan-school",
      });
      await insertLegacyProfile(ctx, {
        interest: "exam-prep",
        programId: currentExam,
        suffix: "current-exam",
      });
      await insertLegacyProfile(ctx, {
        interest: "assessment-prep",
        programId: orphanAssessment,
        suffix: "orphan-assessment",
      });
    });

    await expect(
      t.mutation(internal.learningPrograms.cutover.migrateLearningSelections, {
        dryRun: true,
        reset: true,
      })
    ).resolves.toMatchObject({ processed: 4 });
    await expect(
      t.query(internal.learningPrograms.cutover.auditLearningSelections, {})
    ).resolves.toEqual({
      invalidSelections: 0,
      legacyProfiles: 4,
      migratedProfiles: 0,
      selectionRows: 0,
      unresolvedProfiles: 4,
    });

    await t.action((ctx) =>
      runToCompletion(
        ctx,
        components.migrations,
        internal.learningPrograms.cutover.migrateLearningSelections,
        { cursor: null }
      )
    );

    await expect(
      t.query(internal.learningPrograms.cutover.auditLearningSelections, {})
    ).resolves.toEqual({
      invalidSelections: 0,
      legacyProfiles: 4,
      migratedProfiles: 4,
      selectionRows: 4,
      unresolvedProfiles: 0,
    });
    const selections = await t.query((ctx) =>
      ctx.db.query("learningPreferences").collect()
    );

    expect(
      selections.map(({ learningInterest, primaryProgramKey }) => ({
        learningInterest,
        primaryProgramKey,
      }))
    ).toEqual([
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
      },
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
      },
      { learningInterest: "exam-prep", primaryProgramKey: "snbt" },
      { learningInterest: "assessment-prep", primaryProgramKey: "snbt" },
    ]);
  });
});

/** Builds one selectable signed program with a stable production-like key. */
function makeSelectableProgram(
  index: number,
  key: string,
  kind: LearningProgram["kind"]
) {
  const base = makeTechnicalProgram(index, kind);

  return LearningProgramSchema.make({
    ...base,
    defaultCoverageStatus: "partial",
    key: LearningProgramKeySchema.make(key),
  });
}

/** Inserts one source-owned program row retained only for migration input. */
async function insertLegacyProgram(
  ctx: MutationCtx,
  key: string,
  kind: LearningProgram["kind"]
) {
  return await ctx.db.insert("learningPrograms", {
    defaultCoverageStatus: "partial",
    displayOrder: 1,
    iconKey: "school",
    key,
    kind,
    navigation: { levels: ["track"], model: "curriculum-tree" },
    providerKind: "nakafa",
    providerName: "Legacy migration fixture",
    syncedAt: NOW,
    translations: {
      en: { publicSlug: key, title: key },
      id: { publicSlug: key, title: key },
    },
    updatedAt: NOW,
    versionLabel: "Legacy",
  });
}

/** Inserts one user and the legacy profile that owns its prior selection. */
async function insertLegacyProfile(
  ctx: MutationCtx,
  {
    interest,
    preferredCurriculumProgramKey,
    programId,
    suffix,
  }: {
    interest: "assessment-prep" | "exam-prep" | "school-curriculum";
    preferredCurriculumProgramKey?: string;
    programId: Awaited<ReturnType<typeof insertLegacyProgram>>;
    suffix: string;
  }
) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 10,
    creditsResetAt: NOW,
    email: `${suffix}@example.com`,
    name: suffix,
    plan: "free",
  });

  if (preferredCurriculumProgramKey) {
    await ctx.db.insert("learningPreferences", {
      preferredCurriculumProgramKey,
      updatedAt: NOW,
      userId,
    });
  }

  await ctx.db.insert("learningProfiles", {
    interests: [interest],
    programId,
    updatedAt: NOW,
    userId,
  });
}
