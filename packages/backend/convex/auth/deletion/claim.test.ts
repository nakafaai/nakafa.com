import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { components } from "@repo/backend/convex/_generated/api";
import { claimAccountDeletion } from "@repo/backend/convex/auth/deletion/claim";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const testResend = new Resend(components.resend, {
  apiKey: "re_test_account_deletion_claim",
  testMode: true,
});

describe("auth/deletion/claim", () => {
  it("claims the irreversible phase only from the auth delete hook", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);
    resendTest.register(t);

    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "claimed-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "delivered@resend.dev",
        name: "Claimed Owner",
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
      ctx.db.patch("users", userId, { welcomeEmailId: emailId })
    );

    const prepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID))
    );
    const cancelablePreparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );
    const cancelableUser = await t.query((ctx) => ctx.db.get("users", userId));
    const cancelableEmail = await t.query(components.resend.lib.getStatus, {
      emailId,
    });

    vi.setSystemTime(NOW + 1000);
    const claimed = await t.mutation((ctx) =>
      runConvexProgram(claimAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID))
    );
    const committedPreparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );
    const committedUser = await t.query((ctx) => ctx.db.get("users", userId));
    const committedEmail = await t.query(components.resend.lib.getStatus, {
      emailId,
    });

    expect(prepared).toBe(accountDeletionPreparationOutcome.ready);
    expect(cancelablePreparation).not.toHaveProperty("deletionStartedAt");
    expect(cancelableUser?.welcomeEmailId).toBe(emailId);
    expect(cancelableEmail).toMatchObject({ status: "waiting" });
    expect(claimed).toBe(accountDeletionPreparationOutcome.ready);
    expect(committedPreparation).toMatchObject({
      attemptId: ATTEMPT_ID,
      deletionStartedAt: NOW + 1000,
      recoveryAt: NOW + 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
      recoveryGeneration: 3,
    });
    expect(committedUser).not.toHaveProperty("welcomeEmailId");
    expect(committedEmail).toMatchObject({ status: "cancelled" });
  });
});
