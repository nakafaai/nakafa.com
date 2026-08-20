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
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = 1_799_020_800_000;
const OLD_SELECTION_AT = 1_700_000_000_000;

describe("learningPrograms/selection", () => {
  it.live(
    "lists only selectable programs from the signed active snapshot",
    () =>
      Effect.gen(function* () {
        const target = createConvexTestWithBetterAuth();
        const data = yield* makeProgramSnapshotData([
          makeProgram(1, "merdeka", "school-curriculum", "partial"),
          makeProgram(2, "snbt", "admission-exam", "available"),
          makeProgram(3, "planned-program", "assessment", "planned"),
        ]);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));

        yield* Effect.promise(() =>
          expect(
            target.query(api.learningPrograms.queries.listSelectablePrograms, {
              locale: "id",
            })
          ).resolves.toMatchObject([
            { key: "merdeka", publicSlug: "program-teknis-1" },
            { key: "snbt", publicSlug: "program-teknis-2" },
          ])
        );
      })
  );

  it.live(
    "saves one signed selection without creating profile or plan rows",
    () =>
      Effect.gen(function* () {
        const target = createConvexTestWithBetterAuth();
        const data = yield* makeProgramSnapshotData([
          makeProgram(1, "merdeka", "school-curriculum", "partial"),
          makeProgram(2, "snbt", "admission-exam", "partial"),
        ]);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const identity = yield* Effect.promise(() =>
          target.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
        );

        yield* Effect.promise(() =>
          expect(
            target.query(api.learningPrograms.queries.getActiveSelection, {
              locale: "id",
            })
          ).resolves.toBeNull()
        );
        yield* Effect.promise(() =>
          expect(
            target.mutation(api.learningPrograms.mutations.selectProgram, {
              interest: "school-curriculum",
              locale: "id",
              programKey: "merdeka",
            })
          ).rejects.toThrow("UNAUTHENTICATED")
        );

        const authed = target.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });
        const selected = yield* Effect.promise(() =>
          authed.mutation(api.learningPrograms.mutations.selectProgram, {
            interest: "school-curriculum",
            locale: "id",
            programKey: "merdeka",
          })
        );

        expect(selected).toMatchObject({
          interest: "school-curriculum",
          program: { key: "merdeka" },
        });
        yield* Effect.promise(() =>
          expect(
            authed.query(api.learningPrograms.queries.getActiveSelection, {
              locale: "id",
            })
          ).resolves.toEqual(selected)
        );
        yield* Effect.promise(() =>
          expect(
            target.query((ctx) => ctx.db.query("learningPreferences").unique())
          ).resolves.toMatchObject({
            learningInterest: "school-curriculum",
            preferredCurriculumProgramKey: "merdeka",
            primaryProgramKey: "merdeka",
            selectionUpdatedAt: expect.any(Number),
          })
        );
      })
  );

  it.live("returns no selection after its signed program is retired", () =>
    Effect.gen(function* () {
      const target = createConvexTestWithBetterAuth();
      const data = yield* makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "archived"),
      ]);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      const identity = yield* Effect.promise(() =>
        target.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
      );
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          await ctx.db.insert("learningPreferences", {
            learningInterest: "school-curriculum",
            primaryProgramKey: "merdeka",
            selectionUpdatedAt: NOW,
            updatedAt: NOW,
            userId: identity.userId,
          });
        })
      );
      const authed = target.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      yield* Effect.promise(() =>
        expect(
          authed.query(api.learningPrograms.queries.getActiveSelection, {
            locale: "id",
          })
        ).resolves.toBeNull()
      );
    })
  );

  it.live(
    "refreshes the timestamp when a user explicitly reselects a program",
    () =>
      Effect.gen(function* () {
        const target = createConvexTestWithBetterAuth();
        const data = yield* makeProgramSnapshotData([
          makeProgram(1, "merdeka", "school-curriculum", "partial"),
        ]);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const identity = yield* Effect.promise(() =>
          target.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
        );
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            ctx.db.insert("learningPreferences", {
              learningInterest: "school-curriculum",
              preferredCurriculumProgramKey: "merdeka",
              primaryProgramKey: "merdeka",
              selectionUpdatedAt: OLD_SELECTION_AT,
              updatedAt: OLD_SELECTION_AT,
              userId: identity.userId,
            })
          )
        );
        const authed = target.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });

        yield* Effect.promise(() =>
          authed.mutation(api.learningPrograms.mutations.selectProgram, {
            interest: "school-curriculum",
            locale: "id",
            programKey: "merdeka",
          })
        );

        yield* Effect.promise(() =>
          expect(
            target.query((ctx) => ctx.db.query("learningPreferences").unique())
          ).resolves.toMatchObject({
            selectionUpdatedAt: expect.any(Number),
            updatedAt: expect.any(Number),
          })
        );
        const preference = yield* Effect.promise(() =>
          target.query((ctx) => ctx.db.query("learningPreferences").unique())
        );

        expect(preference?.selectionUpdatedAt).toBeGreaterThan(
          OLD_SELECTION_AT
        );
        expect(preference?.updatedAt).toBeGreaterThan(OLD_SELECTION_AT);
      })
  );

  it.live("rejects missing, planned, and interest-mismatched programs", () =>
    Effect.gen(function* () {
      const target = createConvexTestWithBetterAuth();
      const data = yield* makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
        makeProgram(2, "planned-program", "assessment", "planned"),
      ]);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      const identity = yield* Effect.promise(() =>
        target.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
      );
      const authed = target.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      yield* Effect.promise(() =>
        expect(
          authed.mutation(api.learningPrograms.mutations.selectProgram, {
            interest: "school-curriculum",
            locale: "id",
            programKey: "missing",
          })
        ).rejects.toThrow("LEARNING_PROGRAM_NOT_FOUND")
      );
      yield* Effect.promise(() =>
        expect(
          authed.mutation(api.learningPrograms.mutations.selectProgram, {
            interest: "assessment-prep",
            locale: "id",
            programKey: "planned-program",
          })
        ).rejects.toThrow("LEARNING_PROGRAM_NOT_SELECTABLE")
      );
      yield* Effect.promise(() =>
        expect(
          authed.mutation(api.learningPrograms.mutations.selectProgram, {
            interest: "exam-prep",
            locale: "id",
            programKey: "merdeka",
          })
        ).rejects.toThrow("LEARNING_PROGRAM_INTEREST_MISMATCH")
      );
    })
  );

  it.live(
    "reports duplicate preference rows through the typed persistence contract",
    () =>
      Effect.gen(function* () {
        const target = createConvexTestWithBetterAuth();
        const data = yield* makeProgramSnapshotData([
          makeProgram(1, "merdeka", "school-curriculum", "partial"),
        ]);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const identity = yield* Effect.promise(() =>
          target.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
        );
        yield* Effect.promise(() =>
          target.mutation(async (ctx) => {
            await ctx.db.insert("learningPreferences", {
              updatedAt: NOW,
              userId: identity.userId,
            });
            await ctx.db.insert("learningPreferences", {
              updatedAt: NOW + 1,
              userId: identity.userId,
            });
          })
        );
        const authed = target.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });

        yield* Effect.promise(() =>
          expect(
            authed.mutation(api.learningPrograms.mutations.selectProgram, {
              interest: "school-curriculum",
              locale: "id",
              programKey: "merdeka",
            })
          ).rejects.toThrow("LEARNING_PREFERENCE_PERSISTENCE_FAILED")
        );
      })
  );

  it("fails closed when no signed program snapshot is active", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).rejects.toThrow("CONTENT_RELEASE_MISSING");
  });

  it.live("rejects a signed program whose localized root is missing", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const data = yield* makeProgramSnapshotData([
        makeProgram(1, "merdeka", "school-curriculum", "partial"),
      ]);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          const root = await ctx.db
            .query("curriculumRoutes")
            .withIndex(
              "by_snapshotId_and_appLocale_and_parentPath_and_order_and_path",
              (index) =>
                index
                  .eq("snapshotId", data.snapshotId)
                  .eq("appLocale", "id")
                  .eq("parentPath", undefined)
            )
            .unique();

          if (!root) {
            throw new Error("Expected one localized program root.");
          }

          await ctx.db.delete(root._id);
        })
      );

      yield* Effect.promise(() =>
        expect(
          target.query(api.learningPrograms.queries.listSelectablePrograms, {
            locale: "id",
          })
        ).rejects.toThrow("CONTENT_RELEASE_INTEGRITY")
      );
    })
  );
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
