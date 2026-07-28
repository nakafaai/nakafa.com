import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { components } from "@repo/backend/convex/_generated/api";
import { cancelPendingWelcomeEmail } from "@repo/backend/convex/emails/deletion";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { cancelWelcomeEmailProgram } from "./deletion";

const testResend = new Resend(components.resend, {
  apiKey: "re_test_account_deletion",
  testMode: true,
});

describe("emails/deletion", () => {
  it("cancels the component delivery and clears its app-owned handle", async () => {
    const t = convexTest(schema, convexModules);
    resendTest.register(t);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "welcome-email-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "delivered@resend.dev",
        name: "Welcome Email Owner",
        plan: "free",
      })
    );
    const emailId = await t.mutation((ctx) =>
      testResend.sendEmail(ctx, {
        from: "Nakafa <nakafa@notifications.nakafa.com>",
        subject: "Welcome",
        text: "Welcome",
        to: "delivered@resend.dev",
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", userId, {
        welcomeEmailId: emailId,
      })
    );

    await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);

      if (!user) {
        throw new Error("Expected the welcome email owner.");
      }

      await runConvexProgram(cancelPendingWelcomeEmail(ctx, user));
    });

    const user = await t.query((ctx) => ctx.db.get("users", userId));
    await expect(
      t.query(components.resend.lib.getStatus, {
        emailId,
      })
    ).resolves.toMatchObject({ status: "cancelled" });
    expect(user).not.toHaveProperty("welcomeEmailId");
  });

  it.each(["waiting", "queued"] as const)(
    "cancels and clears a %s welcome email",
    async (status) => {
      const cancel = vi.fn(async () => undefined);
      const clear = vi.fn(async () => undefined);

      await Effect.runPromise(
        cancelWelcomeEmailProgram({
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
        })
      );

      expect(cancel).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledOnce();
    }
  );

  it.each([null, "sent", "delivered", "cancelled"] as const)(
    "clears a non-cancellable %s welcome email without failing deletion",
    async (status) => {
      const cancel = vi.fn(async () => undefined);
      const clear = vi.fn(async () => undefined);

      await Effect.runPromise(
        cancelWelcomeEmailProgram({
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
        })
      );

      expect(cancel).not.toHaveBeenCalled();
      expect(clear).toHaveBeenCalledOnce();
    }
  );
});
