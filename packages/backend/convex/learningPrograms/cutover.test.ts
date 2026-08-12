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
      await insertLegacyProfile(ctx, {
        interests: ["exam-prep", "school-curriculum"],
        programId: currentSchool,
        suffix: "multi-interest-school",
      });
      await insertLegacyProfile(ctx, {
        canonicalSelection: {
          interest: "assessment-prep",
          programKey: "snbt",
          selectionUpdatedAt: NOW + 1,
          updatedAt: NOW + 2,
        },
        interest: "exam-prep",
        programId: currentExam,
        suffix: "newer-canonical",
      });
      await insertLegacyProfile(ctx, {
        canonicalSelection: {
          interest: "exam-prep",
          programKey: "snbt",
          selectionUpdatedAt: NOW + 1,
          updatedAt: NOW + 3,
        },
        interest: "school-curriculum",
        profileUpdatedAt: NOW + 2,
        programId: currentSchool,
        suffix: "newer-legacy",
      });
      await ctx.db.delete(orphanSchool);
      await ctx.db.delete(orphanAssessment);
    });

    await expect(
      t.mutation(internal.learningPrograms.cutover.migrateLearningSelections, {
        dryRun: true,
        reset: true,
      })
    ).resolves.toMatchObject({ processed: 7 });
    await expect(
      t.query(internal.learningPrograms.cutover.auditLearningSelections, {})
    ).resolves.toEqual({
      invalidSelections: 0,
      legacyProfiles: 7,
      missingSelectionTimestamps: 0,
      migratedProfiles: 1,
      selectionRows: 2,
      unresolvedProfiles: 6,
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
      legacyProfiles: 7,
      missingSelectionTimestamps: 0,
      migratedProfiles: 7,
      selectionRows: 7,
      unresolvedProfiles: 0,
    });
    const selections = await t.query(async (ctx) => {
      const preferences = await ctx.db.query("learningPreferences").collect();

      return await Promise.all(
        preferences.map(async (preference) => {
          const user = await ctx.db.get(preference.userId);

          return {
            learningInterest: preference.learningInterest,
            primaryProgramKey: preference.primaryProgramKey,
            user: user?.name,
          };
        })
      );
    });

    expect(
      selections
        .sort((left, right) => left.user?.localeCompare(right.user ?? "") ?? 0)
        .map((selection) => [
          selection.user,
          selection.learningInterest,
          selection.primaryProgramKey,
        ])
    ).toEqual([
      ["current-exam", "exam-prep", "snbt"],
      ["current-school", "school-curriculum", "merdeka"],
      ["multi-interest-school", "school-curriculum", "merdeka"],
      ["newer-canonical", "assessment-prep", "snbt"],
      ["newer-legacy", "school-curriculum", "merdeka"],
      ["orphan-assessment", "assessment-prep", "snbt"],
      ["orphan-school", "school-curriculum", "merdeka"],
    ]);
  });

  it("keeps an independent browsing preference out of profile migration", async () => {
    const merdeka = makeSelectableProgram(1, "merdeka", "school-curriculum");
    const cambridge = makeSelectableProgram(
      2,
      "cambridge-international",
      "school-curriculum"
    );
    const data = await Effect.runPromise(
      makeProgramSnapshotData([merdeka, cambridge])
    );
    const t = convexTest(schema, convexModules);
    migrationsTest.register(t);
    await activateProgramSnapshot(t, data);

    await t.mutation(async (ctx) => {
      const legacyProgramId = await insertLegacyProgram(
        ctx,
        "merdeka",
        "school-curriculum"
      );
      await insertLegacyProfile(ctx, {
        interest: "school-curriculum",
        preferredCurriculumProgramKey: "cambridge-international",
        programId: legacyProgramId,
        suffix: "independent-preference",
      });
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
      t.query((ctx) => ctx.db.query("learningPreferences").unique())
    ).resolves.toMatchObject({
      learningInterest: "school-curriculum",
      preferredCurriculumProgramKey: "cambridge-international",
      primaryProgramKey: "merdeka",
      selectionUpdatedAt: NOW,
    });
  });

  it("detects and remigrates a newer legacy selection", async () => {
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeSelectableProgram(1, "merdeka", "school-curriculum"),
        makeSelectableProgram(2, "snbt", "admission-exam"),
      ])
    );
    const t = convexTest(schema, convexModules);
    migrationsTest.register(t);
    await activateProgramSnapshot(t, data);
    const { examProgramId, userId } = await t.mutation(async (ctx) => {
      const schoolProgramId = await insertLegacyProgram(
        ctx,
        "merdeka",
        "school-curriculum"
      );
      const insertedExamProgramId = await insertLegacyProgram(
        ctx,
        "snbt",
        "admission-exam"
      );
      const insertedUserId = await insertLegacyProfile(ctx, {
        interest: "school-curriculum",
        programId: schoolProgramId,
        suffix: "stale-client",
      });

      return {
        examProgramId: insertedExamProgramId,
        userId: insertedUserId,
      };
    });

    await t.action((ctx) =>
      runToCompletion(
        ctx,
        components.migrations,
        internal.learningPrograms.cutover.migrateLearningSelections,
        { cursor: null }
      )
    );

    await t.mutation(async (ctx) => {
      const profile = await ctx.db
        .query("learningProfiles")
        .withIndex("by_userId", (index) => index.eq("userId", userId))
        .unique();

      if (!profile) {
        throw new Error("Expected one legacy learning profile.");
      }

      await ctx.db.patch(profile._id, {
        interests: ["exam-prep"],
        programId: examProgramId,
        programKey: "snbt",
        updatedAt: NOW + 1,
      });
    });

    await expect(
      t.query(internal.learningPrograms.cutover.auditLearningSelections, {})
    ).resolves.toMatchObject({
      migratedProfiles: 0,
      unresolvedProfiles: 1,
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
    ).resolves.toMatchObject({
      migratedProfiles: 1,
      unresolvedProfiles: 0,
    });
    await expect(
      t.query((ctx) => ctx.db.query("learningPreferences").unique())
    ).resolves.toMatchObject({
      learningInterest: "exam-prep",
      primaryProgramKey: "snbt",
      selectionUpdatedAt: NOW + 1,
    });
  });

  it("rejects newer unresolved evidence and duplicate preference owners", async () => {
    const first = makeSelectableProgram(1, "first", "school-curriculum");
    const second = makeSelectableProgram(2, "second", "school-curriculum");
    const data = await Effect.runPromise(
      makeProgramSnapshotData([first, second])
    );
    const t = convexTest(schema, convexModules);
    migrationsTest.register(t);
    await activateProgramSnapshot(t, data);

    await t.mutation(async (ctx) => {
      const deletedProgramId = await insertLegacyProgram(
        ctx,
        "deleted",
        "school-curriculum"
      );
      await insertLegacyProfile(ctx, {
        canonicalSelection: {
          interest: "school-curriculum",
          programKey: "first",
          selectionUpdatedAt: NOW,
          updatedAt: NOW,
        },
        interest: "school-curriculum",
        profileUpdatedAt: NOW + 1,
        programId: deletedProgramId,
        suffix: "ambiguous",
      });
      await ctx.db.delete(deletedProgramId);
    });

    await expect(
      t.query(internal.learningPrograms.cutover.auditLearningSelections, {})
    ).resolves.toMatchObject({ migratedProfiles: 0, unresolvedProfiles: 1 });

    await expect(
      t.action((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.learningPrograms.cutover.migrateLearningSelections,
          { cursor: null }
        )
      )
    ).rejects.toThrow("LEARNING_SELECTION_MIGRATION_UNRESOLVED");

    const duplicate = convexTest(schema, convexModules);
    await activateProgramSnapshot(duplicate, data);
    await duplicate.mutation(async (ctx) => {
      const programId = await insertLegacyProgram(
        ctx,
        "first",
        "school-curriculum"
      );
      const userId = await insertLegacyProfile(ctx, {
        canonicalSelection: {
          interest: "school-curriculum",
          programKey: "first",
          selectionUpdatedAt: NOW,
          updatedAt: NOW,
        },
        interest: "school-curriculum",
        programId,
        suffix: "duplicate",
      });
      await ctx.db.insert("learningPreferences", {
        learningInterest: "school-curriculum",
        primaryProgramKey: "first",
        selectionUpdatedAt: NOW,
        updatedAt: NOW,
        userId,
      });
    });

    await expect(
      duplicate.query(
        internal.learningPrograms.cutover.auditLearningSelections,
        {}
      )
    ).rejects.toThrow("LEARNING_SELECTION_DUPLICATE_PREFERENCE");
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
    canonicalSelection,
    interest,
    interests,
    preferredCurriculumProgramKey,
    profileUpdatedAt = NOW,
    programId,
    suffix,
  }: {
    canonicalSelection?: {
      interest: "assessment-prep" | "exam-prep" | "school-curriculum";
      programKey: string;
      selectionUpdatedAt: number;
      updatedAt: number;
    };
    interest?: "assessment-prep" | "exam-prep" | "school-curriculum";
    interests?: readonly (
      | "assessment-prep"
      | "exam-prep"
      | "school-curriculum"
    )[];
    preferredCurriculumProgramKey?: string;
    profileUpdatedAt?: number;
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

  if (preferredCurriculumProgramKey || canonicalSelection) {
    await ctx.db.insert("learningPreferences", {
      learningInterest: canonicalSelection?.interest,
      primaryProgramKey: canonicalSelection?.programKey,
      preferredCurriculumProgramKey,
      selectionUpdatedAt: canonicalSelection?.selectionUpdatedAt,
      updatedAt: canonicalSelection?.updatedAt ?? NOW,
      userId,
    });
  }

  await ctx.db.insert("learningProfiles", {
    interests: [...(interests ?? (interest ? [interest] : []))],
    programId,
    updatedAt: profileUpdatedAt,
    userId,
  });

  return userId;
}
