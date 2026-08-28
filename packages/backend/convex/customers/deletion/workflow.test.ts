import { assert, describe, expect, it } from "@effect/vitest";
import { launchDeletedUserCleanupProgram } from "@repo/backend/convex/customers/deletion/workflow";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Clock, Data, Effect } from "effect";
import { vi } from "vitest";

class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
}> {}

class CleanupMutationRejected extends Data.TaggedError(
  "CleanupMutationRejected"
)<{
  readonly cause: unknown;
}> {}

/** Creates isolated adapters for the four independent cleanup workflows. */
function createCleanupStarters() {
  return {
    startAnalytics: vi.fn(() => Promise.resolve()),
    startAuth: vi.fn(() => Promise.resolve()),
    startCustomer: vi.fn(() => Promise.resolve()),
    startData: vi.fn(() => Promise.resolve()),
  };
}

describe("customers/deletion/workflow", () => {
  it.effect("starts cleanup for the matching app user", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const starters = createCleanupStarters();
      const deletedAt = yield* Clock.currentTimeMillis;

      const user = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const insertedUserId = yield* Effect.promise(() =>
                ctx.db.insert("users", {
                  authId: "deleted-auth-user",
                  credits: 0,
                  creditsResetAt: 0,
                  deletedAt,
                  email: "deleted@example.com",
                  name: "Deleted User",
                  plan: "free",
                })
              );
              yield* Effect.promise(() =>
                ctx.db.insert("accountDeletionPreparations", {
                  authId: "deleted-auth-user",
                  finalizedAt: deletedAt,
                  recoveryGeneration: 0,
                  userId: insertedUserId,
                })
              );

              yield* launchDeletedUserCleanupProgram(
                ctx,
                "deleted-auth-user",
                insertedUserId,
                starters
              );

              return yield* Effect.promise(() =>
                ctx.db.get("users", insertedUserId)
              );
            })
          )
        )
      );

      assert(user !== null);
      expect(user.deletionCleanupStartedAt).toEqual(expect.any(Number));
      expect(starters.startAnalytics).toHaveBeenCalledOnce();
      expect(starters.startAuth).toHaveBeenCalledOnce();
      expect(starters.startCustomer).toHaveBeenCalledOnce();
      expect(starters.startData).toHaveBeenCalledOnce();
      const expectedIdentity = {
        authId: "deleted-auth-user",
        userId: user._id,
      };
      expect(starters.startAnalytics).toHaveBeenCalledWith(
        expect.any(Object),
        expectedIdentity
      );
      expect(starters.startAuth).toHaveBeenCalledWith(
        expect.any(Object),
        expectedIdentity
      );
      expect(starters.startCustomer).toHaveBeenCalledWith(
        expect.any(Object),
        expectedIdentity
      );
      expect(starters.startData).toHaveBeenCalledWith(
        expect.any(Object),
        expectedIdentity
      );
    })
  );

  it.effect("does nothing when the app user is already absent", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const starters = createCleanupStarters();
      const missingUserId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const userId = yield* Effect.promise(() =>
                ctx.db.insert("users", {
                  authId: "removed-auth-user",
                  credits: 0,
                  creditsResetAt: 0,
                  email: "removed@example.com",
                  name: "Removed User",
                  plan: "free",
                })
              );
              yield* Effect.promise(() => ctx.db.delete("users", userId));
              return userId;
            })
          )
        )
      );

      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            launchDeletedUserCleanupProgram(
              ctx,
              "missing-auth-user",
              missingUserId,
              starters
            )
          )
        )
      );

      expect(starters.startAnalytics).not.toHaveBeenCalled();
      expect(starters.startAuth).not.toHaveBeenCalled();
      expect(starters.startCustomer).not.toHaveBeenCalled();
      expect(starters.startData).not.toHaveBeenCalled();
    })
  );

  it.effect("returns a typed failure when any workflow cannot start", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const starters = createCleanupStarters();
      starters.startData.mockRejectedValue(
        new WorkflowUnavailable({ message: "workflow unavailable" })
      );
      const deletedAt = yield* Clock.currentTimeMillis;
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: "failing-auth-user",
            credits: 0,
            creditsResetAt: 0,
            deletedAt,
            email: "failing@example.com",
            name: "Failing User",
            plan: "free",
          })
        )
      );

      const failure = yield* Effect.flip(
        Effect.tryPromise({
          catch: (cause) => new CleanupMutationRejected({ cause }),
          try: () =>
            t.mutation((ctx) =>
              runConvexProgram(
                launchDeletedUserCleanupProgram(
                  ctx,
                  "failing-auth-user",
                  userId,
                  starters
                )
              )
            ),
        })
      );
      expect(failure).toMatchObject({
        _tag: "CleanupMutationRejected",
        cause: {
          data: {
            code: "USER_CLEANUP_FAILED",
            message: "workflow unavailable",
          },
        },
      });

      const user = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get("users", userId))
      );

      expect(starters.startAnalytics).toHaveBeenCalledOnce();
      expect(starters.startAuth).toHaveBeenCalledOnce();
      expect(starters.startCustomer).toHaveBeenCalledOnce();
      expect(starters.startData).toHaveBeenCalledOnce();
      expect(user).not.toHaveProperty("deletionCleanupStartedAt");
    })
  );
});
