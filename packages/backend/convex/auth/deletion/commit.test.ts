import { describe, expect, it, vi } from "@effect/vitest";
import { continueAccountDeletionCommitProgram } from "@repo/backend/convex/auth/deletion/commit";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

function seedStartedDeletion(t: ReturnType<typeof convexTest>, authId: string) {
  return Effect.promise(() =>
    t.mutation((ctx) =>
      runConvexProgram(
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
        })
      )
    )
  );
}

describe("auth/deletion/commit", () => {
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
      const t = convexTest(schema, convexModules);
      const seeded = yield* seedStartedDeletion(t, `${testCase.stage}-owner`);
      const deleteAccounts = vi.fn(() =>
        Promise.resolve(testCase.accountCount)
      );
      const deleteAuthUser = vi.fn(() => Promise.resolve());
      const deleteSessions = vi.fn(() =>
        Promise.resolve(testCase.sessionCount)
      );
      const scheduleContinuation = vi.fn(() => Promise.resolve());

      const handled = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            continueAccountDeletionCommitProgram(
              ctx,
              `${testCase.stage}-owner`,
              seeded.expectedPreparation,
              {
                deleteAccounts,
                deleteAuthUser,
                deleteSessions,
                scheduleContinuation,
              }
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const preparation = yield* Effect.promise(() =>
                ctx.db.get("accountDeletionPreparations", seeded.preparationId)
              );
              const user = yield* Effect.promise(() =>
                ctx.db.get("users", seeded.userId)
              );

              return { preparation, user };
            })
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
        const t = convexTest(schema, convexModules);
        const seeded = yield* seedStartedDeletion(t, "final-commit-owner");
        const deleteAuthUser = vi.fn(() => Promise.resolve());

        const handled = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              continueAccountDeletionCommitProgram(
                ctx,
                "final-commit-owner",
                seeded.expectedPreparation,
                {
                  deleteAccounts: vi.fn(() => Promise.resolve(0)),
                  deleteAuthUser,
                  deleteSessions: vi.fn(() => Promise.resolve(0)),
                  scheduleContinuation: vi.fn(() => Promise.resolve()),
                }
              )
            )
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
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

                return { preparation, receipt, user };
              })
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
      patch: { deletionStartedAt: undefined },
      state: "before the irreversible claim",
    },
    {
      patch: { cancellationStartedAt: NOW + 1 },
      state: "after cancellation starts",
    },
  ])("does not touch auth $state", ({ patch }) =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const seeded = yield* seedStartedDeletion(t, "unclaimed-owner");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.patch(
                "accountDeletionPreparations",
                seeded.preparationId,
                patch
              )
            )
          )
        )
      );
      const deleteAuthUser = vi.fn(() => Promise.resolve());
      const deleteSessions = vi.fn(() => Promise.resolve(0));

      const handled = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            continueAccountDeletionCommitProgram(
              ctx,
              "unclaimed-owner",
              seeded.expectedPreparation,
              {
                deleteAccounts: vi.fn(() => Promise.resolve(0)),
                deleteAuthUser,
                deleteSessions,
                scheduleContinuation: vi.fn(() => Promise.resolve()),
              }
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
