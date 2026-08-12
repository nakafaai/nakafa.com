import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
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
const OLD_SELECTION_AT = 1_700_000_000_000;

describe("learningPrograms/selection", () => {
  it("lists only selectable programs from the signed active snapshot", async () => {
    const target = createConvexTestWithBetterAuth();
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
        makeProgram(2, "snbt", "admission-exam", "available"),
        makeProgram(3, "planned-program", "assessment", "planned"),
      ])
    );
    await activateProgramSnapshot(target, data);

    await expect(
      target.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).resolves.toMatchObject([
      { key: "merdeka", publicSlug: "program-teknis-1" },
      { key: "snbt", publicSlug: "program-teknis-2" },
    ]);
  });

  it("saves one signed selection without creating profile or plan rows", async () => {
    const target = createConvexTestWithBetterAuth();
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
        makeProgram(2, "snbt", "admission-exam", "partial"),
      ])
    );
    await activateProgramSnapshot(target, data);
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await expect(
      target.query(api.learningPrograms.queries.getActiveSelection, {
        locale: "id",
      })
    ).resolves.toBeNull();
    await expect(
      target.mutation(api.learningPrograms.mutations.selectProgram, {
        interest: "school-curriculum",
        locale: "id",
        programKey: "merdeka",
      })
    ).rejects.toThrow("UNAUTHENTICATED");

    const authed = target.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const selected = await authed.mutation(
      api.learningPrograms.mutations.selectProgram,
      {
        interest: "school-curriculum",
        locale: "id",
        programKey: "merdeka",
      }
    );

    expect(selected).toMatchObject({
      interest: "school-curriculum",
      program: { key: "merdeka" },
    });
    await expect(
      authed.query(api.learningPrograms.queries.getActiveSelection, {
        locale: "id",
      })
    ).resolves.toEqual(selected);
    await expect(
      target.query(async (ctx) => ({
        items: await ctx.db.query("learningPlanItems").take(1),
        plans: await ctx.db.query("learningPlans").take(1),
        profiles: await ctx.db.query("learningProfiles").take(1),
      }))
    ).resolves.toEqual({ items: [], plans: [], profiles: [] });
    await expect(
      target.query((ctx) => ctx.db.query("learningPreferences").unique())
    ).resolves.toMatchObject({
      learningInterest: "school-curriculum",
      preferredCurriculumProgramKey: "merdeka",
      primaryProgramKey: "merdeka",
      selectionUpdatedAt: expect.any(Number),
    });
  });

  it("fails closed when a retained profile has no canonical selection", async () => {
    const target = createConvexTestWithBetterAuth();
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    await target.mutation(async (ctx) => {
      const programId = await ctx.db.insert("learningPrograms", {
        defaultCoverageStatus: "partial",
        displayOrder: 1,
        iconKey: "school",
        key: "merdeka",
        kind: "school-curriculum",
        navigation: { levels: ["track"], model: "curriculum-tree" },
        providerKind: "nakafa",
        providerName: "Retained cutover fixture",
        syncedAt: NOW,
        translations: {
          en: { publicSlug: "merdeka", title: "Merdeka" },
          id: { publicSlug: "merdeka", title: "Merdeka" },
        },
        updatedAt: NOW,
        versionLabel: "Legacy",
      });
      await ctx.db.insert("learningProfiles", {
        interests: ["school-curriculum"],
        programId,
        updatedAt: NOW,
        userId: identity.userId,
      });
    });
    const authed = target.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.query(api.learningPrograms.queries.getActiveSelection, {
        locale: "id",
      })
    ).rejects.toThrow("LEARNING_SELECTION_CUTOVER_REQUIRED");
  });

  it("refreshes the timestamp when a user explicitly reselects a program", async () => {
    const target = createConvexTestWithBetterAuth();
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
      ])
    );
    await activateProgramSnapshot(target, data);
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    await target.mutation((ctx) =>
      ctx.db.insert("learningPreferences", {
        learningInterest: "school-curriculum",
        preferredCurriculumProgramKey: "merdeka",
        primaryProgramKey: "merdeka",
        selectionUpdatedAt: OLD_SELECTION_AT,
        updatedAt: OLD_SELECTION_AT,
        userId: identity.userId,
      })
    );
    const authed = target.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await authed.mutation(api.learningPrograms.mutations.selectProgram, {
      interest: "school-curriculum",
      locale: "id",
      programKey: "merdeka",
    });

    await expect(
      target.query((ctx) => ctx.db.query("learningPreferences").unique())
    ).resolves.toMatchObject({
      selectionUpdatedAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
    const preference = await target.query((ctx) =>
      ctx.db.query("learningPreferences").unique()
    );

    expect(preference?.selectionUpdatedAt).toBeGreaterThan(OLD_SELECTION_AT);
    expect(preference?.updatedAt).toBeGreaterThan(OLD_SELECTION_AT);
  });

  it("rejects missing, planned, and interest-mismatched programs", async () => {
    const target = createConvexTestWithBetterAuth();
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
        makeProgram(2, "planned-program", "assessment", "planned"),
      ])
    );
    await activateProgramSnapshot(target, data);
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    const authed = target.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectProgram, {
        interest: "school-curriculum",
        locale: "id",
        programKey: "missing",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_NOT_FOUND");
    await expect(
      authed.mutation(api.learningPrograms.mutations.selectProgram, {
        interest: "assessment-prep",
        locale: "id",
        programKey: "planned-program",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_NOT_SELECTABLE");
    await expect(
      authed.mutation(api.learningPrograms.mutations.selectProgram, {
        interest: "exam-prep",
        locale: "id",
        programKey: "merdeka",
      })
    ).rejects.toThrow("LEARNING_PROGRAM_INTEREST_MISMATCH");
  });

  it("reports duplicate preference rows through the typed persistence contract", async () => {
    const target = createConvexTestWithBetterAuth();
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
      ])
    );
    await activateProgramSnapshot(target, data);
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    await target.mutation(async (ctx) => {
      await ctx.db.insert("learningPreferences", {
        updatedAt: NOW,
        userId: identity.userId,
      });
      await ctx.db.insert("learningPreferences", {
        updatedAt: NOW + 1,
        userId: identity.userId,
      });
    });
    const authed = target.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.learningPrograms.mutations.selectProgram, {
        interest: "school-curriculum",
        locale: "id",
        programKey: "merdeka",
      })
    ).rejects.toThrow("LEARNING_PREFERENCE_PERSISTENCE_FAILED");
  });

  it("fails closed when no signed program snapshot is active", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).rejects.toThrow("CONTENT_RELEASE_MISSING");
  });

  it("rejects a signed program whose localized root is missing", async () => {
    const target = convexTest(schema, convexModules);
    const data = await Effect.runPromise(
      makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
      ])
    );
    await activateProgramSnapshot(target, data);
    await target.mutation(async (ctx) => {
      const root = await ctx.db
        .query("curriculumRoutes")
        .withIndex(
          "by_snapshotId_and_locale_and_parentPath_and_order_and_path",
          (index) =>
            index
              .eq("snapshotId", data.snapshotId)
              .eq("locale", "id")
              .eq("parentPath", undefined)
        )
        .unique();

      if (!root) {
        throw new Error("Expected one localized program root.");
      }

      await ctx.db.delete(root._id);
    });

    await expect(
      target.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).rejects.toThrow("CONTENT_RELEASE_INTEGRITY");
  });
});

/** Builds one signed program fixture with explicit key and coverage. */
function makeProgram(
  index: number,
  key: string,
  kind: LearningProgram["kind"],
  defaultCoverageStatus: LearningProgram["defaultCoverageStatus"]
) {
  const base = makeTechnicalProgram(index, kind);

  return LearningProgramSchema.make({
    ...base,
    defaultCoverageStatus,
    key: LearningProgramKeySchema.make(key),
  });
}
