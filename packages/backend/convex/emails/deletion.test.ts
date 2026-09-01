import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/convex/_generated/api";
import {
  cancelPendingWelcomeEmail,
  cancelWelcomeEmailProgram,
} from "@repo/backend/convex/emails/deletion";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const testResend = new Resend(components.resend, {
  apiKey: "re_test_account_deletion",
  testMode: true,
});

describe("emails/deletion", () => {
  it.effect(
    "cancels the component delivery and clears its app-owned handle",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        resendTest.register(t);
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.insert("users", {
              authId: "welcome-email-owner",
              credits: 0,
              creditsResetAt: 0,
              email: "delivered@resend.dev",
              name: "Welcome Email Owner",
              plan: "free",
            })
          )
        );
        const emailId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            testResend.sendEmail(ctx, {
              from: "Nakafa <nakafa@notifications.nakafa.com>",
              subject: "Welcome",
              text: "Welcome",
              to: "delivered@resend.dev",
            })
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", userId, {
              welcomeEmailId: emailId,
            })
          )
        );

        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const user = yield* Effect.promise(() =>
                  ctx.db.get("users", userId)
                );

                if (!user) {
                  return yield* Effect.die(
                    new Error("Expected the welcome email owner.")
                  );
                }

                yield* cancelPendingWelcomeEmail(ctx, user);
              })
            )
          )
        );

        const user = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.get("users", userId))
        );
        const status = yield* Effect.promise(() =>
          t.query(components.resend.lib.getStatus, {
            emailId,
          })
        );

        expect(status).toMatchObject({ status: "cancelled" });
        expect(user).not.toHaveProperty("welcomeEmailId");
      })
  );

  it.effect.each(["waiting", "queued"] as const)(
    "cancels and clears a %s welcome email",
    (status) =>
      Effect.gen(function* () {
        const cancel = vi.fn(async () => undefined);
        const clear = vi.fn(async () => undefined);

        yield* cancelWelcomeEmailProgram({
          cancel,
          clear,
          loadStatus: vi.fn(async () => ({
            bounced: false,
            clicked: false,
            complained: false,
            deliveryDelayed: false,
            errorMessage: null,
            failed: false,
            opened: false,
            status,
          })),
        });

        expect(cancel).toHaveBeenCalledOnce();
        expect(clear).toHaveBeenCalledOnce();
      })
  );

  it.effect.each([null, "sent", "delivered", "cancelled"] as const)(
    "clears a non-cancellable %s welcome email without failing deletion",
    (status) =>
      Effect.gen(function* () {
        const cancel = vi.fn(async () => undefined);
        const clear = vi.fn(async () => undefined);

        yield* cancelWelcomeEmailProgram({
          cancel,
          clear,
          loadStatus: vi.fn(async () =>
            status === null
              ? null
              : {
                  bounced: false,
                  clicked: false,
                  complained: false,
                  deliveryDelayed: false,
                  errorMessage: null,
                  failed: false,
                  opened: false,
                  status,
                }
          ),
        });

        expect(cancel).not.toHaveBeenCalled();
        expect(clear).toHaveBeenCalledOnce();
      })
  );
});
