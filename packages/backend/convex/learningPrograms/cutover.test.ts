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
          updatedAt: NOW + 1,
        },
        interest: "exam-prep",
        programId: currentExam,
        suffix: "newer-canonical",
      });
      await insertLegacyProfile(ctx, {
        canonicalSelection: {
          interest: "exam-prep",
          programKey: "snbt",
          updatedAt: NOW + 1,
        },
        interest: "school-curriculum",
        profileUpdatedAt: NOW + 2,
        programId: currentSchool,
        suffix: "newer-legacy",
      });
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
      migratedProfiles: 2,
      selectionRows: 2,
      unresolvedProfiles: 5,
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
      selections.sort(
        (left, right) => left.user?.localeCompare(right.user ?? "") ?? 0
      )
    ).toEqual([
      {
        learningInterest: "exam-prep",
        primaryProgramKey: "snbt",
        user: "current-exam",
      },
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
        user: "current-school",
      },
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
        user: "multi-interest-school",
      },
      {
        learningInterest: "assessment-prep",
        primaryProgramKey: "snbt",
        user: "newer-canonical",
      },
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
        user: "newer-legacy",
      },
      {
        learningInterest: "assessment-prep",
        primaryProgramKey: "snbt",
        user: "orphan-assessment",
      },
      {
        learningInterest: "school-curriculum",
        primaryProgramKey: "merdeka",
        user: "orphan-school",
      },
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
}
