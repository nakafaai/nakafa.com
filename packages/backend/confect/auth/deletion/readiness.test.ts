import { afterEach, describe, expect, it } from "@effect/vitest";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE } from "@repo/backend/confect/auth/deletion/constants";
import { verifyAccountDeletionPreparation } from "@repo/backend/confect/auth/deletion/readiness";
import { accountDeletionPreparationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  accountDeletionRequest,
  betterAuthUser,
  withPostHogErasureConfig,
} from "@repo/backend/test/auth";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
/** The rejection that a deletion gets while its preparation is temporarily unavailable. */
const deletionUnavailable = {
  body: {
    code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
  },
  status: "INTERNAL_SERVER_ERROR",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("auth/deletion/readiness", () => {
  it.effect("accepts one ready preparation step", () =>
    Effect.gen(function* () {
      const prepare = vi.fn(() =>
        Effect.succeed(accountDeletionPreparationOutcome.ready)
      );
      expect(
        yield* verifyAccountDeletionPreparation(Effect.suspend(prepare))
      ).toBeUndefined();
      expect(prepare).toHaveBeenCalledOnce();
    })
  );
  it.effect("maps an unavailable preparation without retrying it", () =>
    Effect.gen(function* () {
      const prepare = vi.fn(() =>
        Effect.succeed(accountDeletionPreparationOutcome.temporarilyUnavailable)
      );
      const failure = yield* verifyAccountDeletionPreparation(
        Effect.suspend(prepare)
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({
        body: {
          code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
        },
        name: "APIError",
        status: "INTERNAL_SERVER_ERROR",
      });
      expect(prepare).toHaveBeenCalledOnce();
    })
  );
  it.effect.each(["failure", "defect"] as const)(
    "sanitizes adapter %s without retrying inside the auth request",
    (kind) =>
      Effect.gen(function* () {
        const prepare = vi.fn(() =>
          kind === "failure"
            ? Effect.fail(
                toUserCleanupError(new Error("preparation unavailable"))
              )
            : Effect.die(new Error("private adapter detail"))
        );
        const failure = yield* verifyAccountDeletionPreparation(
          Effect.suspend(prepare)
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          body: {
            code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          },
          name: "APIError",
          status: "INTERNAL_SERVER_ERROR",
        });
        expect(prepare).toHaveBeenCalledOnce();
        const serializedFailure =
          yield* Schema.encodeEffect(JsonTextSchema)(failure);
        expect(serializedFailure).not.toContain("private adapter detail");
      })
  );
  it.effect("claims deletion through the Better Auth action hook", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      yield* Effect.sync(() => vi.setSystemTime(NOW));
      const test = createConvexTestWithBetterAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "deletion-runtime-hook",
          })
        )
      );
      const authenticated = test.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });
      const prepared = yield* Effect.promise(() =>
        authenticated.mutation(
          api.auth.deletion.prepareCurrentAccountDeletion,
          {
            attemptId: ATTEMPT_ID,
          }
        )
      );
      yield* Effect.promise(() =>
        test.action((ctx) =>
          createAuthOptions(ctx).user.deleteUser.beforeDelete(
            betterAuthUser(identity.authUserId, NOW),
            accountDeletionRequest(ATTEMPT_ID)
          )
        )
      );
      const preparation = yield* Effect.promise(() =>
        test.query((ctx) =>
          ctx.db.query("accountDeletionPreparations").unique()
        )
      );
      expect(prepared).toBe(accountDeletionPreparationOutcome.ready);
      expect(preparation?.deletionStartedAt).toBe(NOW);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          vi.unstubAllEnvs();
          vi.useRealTimers();
        })
      )
    )
  );
  it.effect("rejects deletion outside an action context", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      const test = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            createAuthOptions(ctx).user.deleteUser.beforeDelete(
              betterAuthUser("mutation-context-user", NOW),
              accountDeletionRequest(ATTEMPT_ID)
            )
          )
        ).rejects.toMatchObject(deletionUnavailable)
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
  it.effect("requires the browser deletion attempt header", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      const test = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        expect(
          test.action((ctx) =>
            createAuthOptions(ctx).user.deleteUser.beforeDelete(
              betterAuthUser("missing-attempt-user", NOW),
              undefined
            )
          )
        ).rejects.toMatchObject(deletionUnavailable)
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
});
