import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/convex/_generated/api";
import { claimAccountDeletion } from "@repo/backend/convex/auth/deletion/claim";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { seedDeletionUser } from "@repo/backend/test/deletion/seed";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const testResend = new Resend(components.resend, {
  apiKey: "re_test_account_deletion_claim",
  testMode: true,
});

describe("auth/deletion/claim", () => {
  it.effect("does not claim a canceled browser attempt", () =>
    Effect.gen(function* () {
      const test = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        test.mutation(async (ctx) => {
          const insertedUserId = await seedDeletionUser(
            ctx,
            "canceled-claim-owner"
          );
          await ctx.db.insert("accountDeletionAttemptCancellations", {
            attemptId: ATTEMPT_ID,
            canceledAt: NOW,
          });
          return insertedUserId;
        })
      );

      const outcome = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            claimAccountDeletion(ctx, "canceled-claim-owner", ATTEMPT_ID)
          )
        )
      );
      const state = yield* Effect.promise(() =>
        test.query(async (ctx) => ({
          preparation: await ctx.db
            .query("accountDeletionPreparations")
            .unique(),
          user: await ctx.db.get("users", userId),
        }))
      );

      expect(outcome).toBe(
        accountDeletionPreparationOutcome.temporarilyUnavailable
      );
      expect(state.preparation).toBeNull();
      expect(state.user).not.toHaveProperty("deletionPreparedAt");
    })
  );

  it.effect("treats an account already absent as deleted", () =>
    Effect.gen(function* () {
      const test = convexTest(schema, convexModules);

      const outcome = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            claimAccountDeletion(ctx, "already-absent", ATTEMPT_ID)
          )
        )
      );
      const preparation = yield* Effect.promise(() =>
        test.query((ctx) =>
          ctx.db.query("accountDeletionPreparations").unique()
        )
      );

      expect(outcome).toBe(accountDeletionPreparationOutcome.ready);
      expect(preparation).toBeNull();
    })
  );

  it.effect(
    "claims the irreversible phase only from the auth delete hook",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() => vi.setSystemTime(NOW));
        const test = convexTest(schema, convexModules);
        yield* Effect.sync(() => resendTest.register(test));

        const userId = yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                ctx.db.insert("users", {
                  authId: "claimed-owner",
                  credits: 0,
                  creditsResetAt: 0,
                  email: "delivered@resend.dev",
                  name: "Claimed Owner",
                  plan: "free",
                })
              )
            )
          )
        );
        const emailId = yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                testResend.sendEmail(ctx, {
                  from: "Nakafa <nakafa@notifications.nakafa.com>",
                  subject: "Welcome",
                  text: "Welcome",
                  to: "delivered@resend.dev",
                })
              )
            )
          )
        );
        const intentEmailId = yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                testResend.sendEmail(ctx, {
                  from: "Nakafa <nakafa@notifications.nakafa.com>",
                  subject: "Account ready",
                  text: "Account ready",
                  to: "delivered@resend.dev",
                })
              )
            )
          )
        );
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(async () => {
                await ctx.db.patch("users", userId, {
                  welcomeEmailId: emailId,
                });
                await ctx.db.insert("welcomeEmailIntents", {
                  componentEmailId: intentEmailId,
                  phase: "enqueued",
                  userId,
                });
              })
            )
          )
        );

        const prepared = yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              prepareAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID)
            )
          )
        );
        const cancelablePreparation = yield* Effect.promise(() =>
          test.query((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                ctx.db.query("accountDeletionPreparations").unique()
              )
            )
          )
        );
        const cancelableUser = yield* Effect.promise(() =>
          test.query((ctx) =>
            runConvexProgram(Effect.promise(() => ctx.db.get("users", userId)))
          )
        );
        const cancelableEmail = yield* Effect.promise(() =>
          test.query(components.resend.lib.getStatus, { emailId })
        );
        const cancelableIntentEmail = yield* Effect.promise(() =>
          test.query(components.resend.lib.getStatus, {
            emailId: intentEmailId,
          })
        );

        yield* Effect.sync(() => vi.setSystemTime(NOW + 1000));
        const claimed = yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              claimAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID)
            )
          )
        );
        const committedPreparation = yield* Effect.promise(() =>
          test.query((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                ctx.db.query("accountDeletionPreparations").unique()
              )
            )
          )
        );
        const committedUser = yield* Effect.promise(() =>
          test.query((ctx) =>
            runConvexProgram(Effect.promise(() => ctx.db.get("users", userId)))
          )
        );
        const committedEmail = yield* Effect.promise(() =>
          test.query(components.resend.lib.getStatus, { emailId })
        );
        const committedIntentEmail = yield* Effect.promise(() =>
          test.query(components.resend.lib.getStatus, {
            emailId: intentEmailId,
          })
        );
        const committedIntent = yield* Effect.promise(() =>
          test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
        );

        expect(prepared).toBe(accountDeletionPreparationOutcome.ready);
        expect(cancelablePreparation).not.toHaveProperty("deletionStartedAt");
        expect(cancelableUser?.welcomeEmailId).toBe(emailId);
        expect(cancelableEmail).toMatchObject({ status: "waiting" });
        expect(cancelableIntentEmail).toMatchObject({ status: "waiting" });
        expect(claimed).toBe(accountDeletionPreparationOutcome.ready);
        expect(committedPreparation).toMatchObject({
          attemptId: ATTEMPT_ID,
          deletionStartedAt: NOW + 1000,
          recoveryAt: NOW + 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
          recoveryGeneration: 3,
        });
        expect(committedUser).not.toHaveProperty("welcomeEmailId");
        expect(committedEmail).toMatchObject({ status: "cancelled" });
        expect(committedIntentEmail).toMatchObject({ status: "cancelled" });
        expect(committedIntent).toBeNull();
      }).pipe(Effect.ensuring(Effect.sync(() => vi.useRealTimers())))
  );
});
