import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import {
  launchDeletedUserCleanupProgram,
  type StartCleanupWorkflow,
} from "@repo/backend/confect/auth/deletion/workflow";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest } from "convex-test";
import { Clock, Data, Effect, Record } from "effect";

class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
}> {}
class CleanupMutationRejected extends Data.TaggedError(
  "CleanupMutationRejected"
)<{
  readonly cause: unknown;
}> {}

/** Creates isolated adapters for the three independent cleanup workflows. */
function createCleanupStarters() {
  return {
    startAnalytics: vi.fn<StartCleanupWorkflow>(() => Effect.void),
    startBilling: vi.fn<StartCleanupWorkflow>(() => Effect.void),
    startData: vi.fn<StartCleanupWorkflow>(() => Effect.void),
  };
}
describe("auth/deletion/workflow", () => {
  it.effect("starts cleanup for the matching app user", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const starters = createCleanupStarters();
      const deletedAt = yield* Clock.currentTimeMillis;
      const user = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              const insertedUserId = yield* Effect.promise(() =>
                ctx.db.insert("users", {
                  credits: 0,
                  creditsResetAt: 0,
                  deletedAt,
                  email: "deleted@example.com",
                  mascot: MASCOT_CODE,
                  name: "Deleted User",
                  plan: "free",
                })
              );
              yield* launchDeletedUserCleanupProgram(insertedUserId, starters);
              return yield* Effect.promise(() =>
                ctx.db.get("users", insertedUserId)
              );
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      assert(user !== null);
      expect(user.deletionCleanupStartedAt).toEqual(expect.any(Number));
      for (const start of Record.values(starters)) {
        expect(start).toHaveBeenCalledExactlyOnceWith(user._id);
      }
    })
  );
  it.effect(
    "does nothing for an account that is gone, live, or already cleaning up",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const starters = createCleanupStarters();
        const missingUserId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const userId = yield* Effect.promise(() =>
                  ctx.db.insert("users", {
                    credits: 0,
                    creditsResetAt: 0,
                    email: "removed@example.com",
                    mascot: MASCOT_CODE,
                    name: "Removed User",
                    plan: "free",
                  })
                );
                yield* Effect.promise(() => ctx.db.delete("users", userId));
                return userId;
              }).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const [live, started] = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const account = (deletion: object) =>
              ctx.db.insert("users", {
                credits: 0,
                creditsResetAt: 0,
                email: "kept@example.com",
                mascot: MASCOT_CODE,
                name: "Kept User",
                plan: "free",
                ...deletion,
              });
            return [
              await account({}),
              await account({ deletedAt: 1, deletionCleanupStartedAt: 2 }),
            ];
          })
        );
        for (const userId of [missingUserId, live, started]) {
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                launchDeletedUserCleanupProgram(userId, starters).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          );
        }
        for (const start of Record.values(starters)) {
          expect(start).not.toHaveBeenCalled();
        }
      })
  );
  it.effect("returns a typed failure when any workflow cannot start", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const starters = createCleanupStarters();
      starters.startData.mockReturnValue(
        Effect.fail(
          toUserCleanupError(
            new WorkflowUnavailable({
              message: "workflow unavailable",
            })
          )
        )
      );
      const deletedAt = yield* Clock.currentTimeMillis;
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            credits: 0,
            creditsResetAt: 0,
            deletedAt,
            email: "failing@example.com",
            mascot: MASCOT_CODE,
            name: "Failing User",
            plan: "free",
          })
        )
      );
      const failure = yield* Effect.flip(
        Effect.tryPromise({
          catch: (cause) =>
            new CleanupMutationRejected({
              cause,
            }),
          try: () =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                launchDeletedUserCleanupProgram(userId, starters).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            ),
        })
      );
      expect(failure).toMatchObject({
        _tag: "CleanupMutationRejected",
        cause: {
          _tag: "UserCleanupError",
          code: "USER_CLEANUP_FAILED",
          message: "Unable to complete account cleanup.",
        },
      });
      const user = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get("users", userId))
      );
      for (const start of Record.values(starters)) {
        expect(start).toHaveBeenCalledOnce();
      }
      expect(user).not.toHaveProperty("deletionCleanupStartedAt");
    })
  );
});
