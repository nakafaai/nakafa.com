import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { continueAccountDeletionCommitProgram } from "@repo/backend/confect/auth/deletion/commit";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
function seedStartedDeletion(t: ReturnType<typeof convexTest>, authId: string) {
  return Effect.promise(() =>
    t.mutation((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const userId = yield* Effect.promise(() =>
            ctx.db.insert("users", {
              authId,
              credits: 0,
              creditsResetAt: 0,
              deletionPreparedAt: NOW,
              email: `${authId}@example.com`,
              name: authId,
              plan: "free",
            })
          );
          const preparationId = yield* Effect.promise(() =>
            ctx.db.insert("accountDeletionPreparations", {
              attemptId: ATTEMPT_ID,
              authId,
              deletionStartedAt: NOW,
              readyAt: NOW,
              recoveryAt: NOW,
              recoveryGeneration: 1,
              userId,
            })
          );
          return {
            expectedPreparation: {
              attemptId: ATTEMPT_ID,
              preparationId,
              recoveryGeneration: 1,
            },
            preparationId,
            userId,
          };
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    )
  );
}
describe("auth/deletion/commit", () => {
  afterEach(() => vi.useRealTimers());
  it("deletes real Better Auth sessions before committing identity removal and its app receipt", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(NOW);
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "native-deletion",
      });
      await ctx.db.patch("users", user.userId, {
        deletionPreparedAt: NOW,
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: user.authUserId,
        deletionStartedAt: NOW,
        readyAt: NOW,
        recoveryAt: NOW,
        recoveryGeneration: 1,
        userId: user.userId,
      });
      return {
        ...user,
        expectedPreparation: {
          attemptId: ATTEMPT_ID,
          preparationId,
          recoveryGeneration: 1,
        },
      };
    });
    const args = {
      authId: seeded.authUserId,
      expectedPreparation: seeded.expectedPreparation,
    };
    const read = () =>
      t.query(async (ctx) => ({
        auth: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [
            {
              field: "_id",
              value: seeded.authUserId,
            },
          ],
        }),
        session: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "session",
          where: [
            {
              field: "_id",
              value: seeded.sessionId,
            },
          ],
        }),
        preparation: await ctx.db.get(
          "accountDeletionPreparations",
          seeded.expectedPreparation.preparationId
        ),
        receipt: await ctx.db.query("accountDeletionReceipts").unique(),
        user: await ctx.db.get("users", seeded.userId),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
    expect(
      await t.mutation(
        internal.auth.deletion.continueAccountDeletionCommit,
        args
      )
    ).toBe(true);
    const pending = await read();
    expect(pending.auth).not.toBeNull();
    expect(pending.session).toBeNull();
    expect(pending.preparation?.finalizedAt).toBeUndefined();
    expect(pending.receipt).toBeNull();
    expect(pending.jobs).toMatchObject([
      {
        args: [args],
        name: "auth/deletion:continueAccountDeletionCommit",
        state: {
          kind: "pending",
        },
      },
    ]);
    expect(
      await t.mutation(
        internal.auth.deletion.continueAccountDeletionCommit,
        args
      )
    ).toBe(true);
    const complete = await read();
    expect(complete.auth).toBeNull();
    expect(complete.preparation?.finalizedAt).toBe(NOW);
    expect(complete.receipt).toMatchObject({
      attemptId: ATTEMPT_ID,
    });
    expect(complete.user).toMatchObject({
      authId: `deleted:${seeded.userId}`,
      deletedAt: NOW,
      name: "Deleted user",
    });
    await expect(
      t.mutation(internal.auth.deletion.continueAccountDeletionCommit, args)
    ).resolves.toBe(true);
    expect(await read()).toEqual(complete);
  });
  it.effect.each([-1, 0.5])(
    "rejects an invalid Better Auth deletion count %s before removing the identity",
    (count) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const seeded = yield* seedStartedDeletion(t, "invalid-count");
        yield* Effect.promise(async () => {
          await expect(
            t.mutation((ctx) => {
              vi.spyOn(ctx, "runMutation").mockResolvedValueOnce({
                count,
              });
              return Effect.runPromiseWith(runtimeServices)(
                continueAccountDeletionCommitProgram(
                  "invalid-count",
                  seeded.expectedPreparation
                ).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              );
            })
          ).rejects.toMatchObject({
            code: "USER_CLEANUP_FAILED",
          });
          expect(
            await t.query((ctx) => ctx.db.get("users", seeded.userId))
          ).not.toHaveProperty("deletedAt");
          expect(
            await t.query((ctx) =>
              ctx.db.get("accountDeletionPreparations", seeded.preparationId)
            )
          ).not.toHaveProperty("finalizedAt");
        });
      })
  );
  it.effect.each([
    {
      accountCount: 0,
      expectedAccountCalls: 0,
      sessionCount: 1,
      stage: "sessions",
    },
    {
      accountCount: 1,
      expectedAccountCalls: 1,
      sessionCount: 0,
      stage: "accounts",
    },
  ])("continues after deleting one bounded $stage page", (testCase) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const seeded = yield* seedStartedDeletion(t, `${testCase.stage}-owner`);
      const deleteAccounts = vi.fn(() => Effect.succeed(testCase.accountCount));
      const deleteAuthUser = vi.fn(() => Effect.void);
      const deleteSessions = vi.fn(() => Effect.succeed(testCase.sessionCount));
      const scheduleContinuation = vi.fn(() => Effect.void);
      const handled = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            continueAccountDeletionCommitProgram(
              `${testCase.stage}-owner`,
              seeded.expectedPreparation,
              {
                deleteAccounts: Effect.suspend(deleteAccounts),
                deleteAuthUser: Effect.suspend(deleteAuthUser),
                deleteSessions: Effect.suspend(deleteSessions),
                scheduleContinuation: Effect.suspend(scheduleContinuation),
              }
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              const preparation = yield* Effect.promise(() =>
                ctx.db.get("accountDeletionPreparations", seeded.preparationId)
              );
              const user = yield* Effect.promise(() =>
                ctx.db.get("users", seeded.userId)
              );
              return {
                preparation,
                user,
              };
            }).pipe(
              Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
            )
          )
        )
      );
      expect(handled).toBe(true);
      expect(deleteSessions).toHaveBeenCalledOnce();
      expect(deleteAccounts).toHaveBeenCalledTimes(
        testCase.expectedAccountCalls
      );
      expect(deleteAuthUser).not.toHaveBeenCalled();
      expect(scheduleContinuation).toHaveBeenCalledOnce();
      expect(state.preparation).not.toHaveProperty("finalizedAt");
      expect(state.user).not.toHaveProperty("deletedAt");
    })
  );
  it.effect(
    "deletes the auth user and finalizes the app record atomically",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const seeded = yield* seedStartedDeletion(t, "final-commit-owner");
        const deleteAuthUser = vi.fn(() => Effect.void);
        const handled = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              continueAccountDeletionCommitProgram(
                "final-commit-owner",
                seeded.expectedPreparation,
                {
                  deleteAccounts: Effect.succeed(0),
                  deleteAuthUser: Effect.suspend(deleteAuthUser),
                  deleteSessions: Effect.succeed(0),
                  scheduleContinuation: Effect.void,
                }
              ).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const preparation = yield* Effect.promise(() =>
                  ctx.db.get(
                    "accountDeletionPreparations",
                    seeded.preparationId
                  )
                );
                const receipt = yield* Effect.promise(() =>
                  ctx.db.query("accountDeletionReceipts").unique()
                );
                const user = yield* Effect.promise(() =>
                  ctx.db.get("users", seeded.userId)
                );
                return {
                  preparation,
                  receipt,
                  user,
                };
              }).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
            )
          )
        );
        expect(handled).toBe(true);
        expect(deleteAuthUser).toHaveBeenCalledOnce();
        expect(state.preparation?.finalizedAt).toEqual(expect.any(Number));
        expect(state.receipt?.attemptId).toBe(ATTEMPT_ID);
        expect(state.user).toMatchObject({
          authId: `deleted:${seeded.userId}`,
          deletedAt: expect.any(Number),
          email: `deleted-${seeded.userId}@account.nakafa.invalid`,
          name: "Deleted user",
        });
      })
  );
  it.effect.each([
    {
      patch: {
        deletionStartedAt: undefined,
      },
      state: "before the irreversible claim",
    },
    {
      patch: {
        cancellationStartedAt: NOW + 1,
      },
      state: "after cancellation starts",
    },
  ])("does not touch auth $state", ({ patch }) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const seeded = yield* seedStartedDeletion(t, "unclaimed-owner");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.patch(
            "accountDeletionPreparations",
            seeded.preparationId,
            patch
          )
        )
      );
      const deleteAuthUser = vi.fn(() => Effect.void);
      const deleteSessions = vi.fn(() => Effect.succeed(0));
      const handled = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            continueAccountDeletionCommitProgram(
              "unclaimed-owner",
              seeded.expectedPreparation,
              {
                deleteAccounts: Effect.succeed(0),
                deleteAuthUser: Effect.suspend(deleteAuthUser),
                deleteSessions: Effect.suspend(deleteSessions),
                scheduleContinuation: Effect.void,
              }
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(handled).toBe(false);
      expect(deleteSessions).not.toHaveBeenCalled();
      expect(deleteAuthUser).not.toHaveBeenCalled();
    })
  );
});
