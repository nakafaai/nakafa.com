import { type EmailStatus, Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components, internal } from "@repo/backend/convex/_generated/api";
import { resend } from "@repo/backend/convex/emails/client";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest, type TestConvex } from "convex-test";

const testResend = new Resend(components.resend, {
  apiKey: "re_test_welcome_reconciliation",
  testMode: true,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function insertEnqueuedIntent(
  test: TestConvex<typeof schema>,
  suffix: string,
  status: EmailStatus["status"]
) {
  return await test.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: `reconcile-${suffix}`,
      credits: 0,
      creditsResetAt: 0,
      email: `${suffix}@example.com`,
      name: `Synthetic ${suffix}`,
      plan: "free",
    });
    const componentEmailId = await testResend.sendEmailManually(
      ctx,
      {
        from: "Nakafa <nakafa@notifications.nakafa.com>",
        subject: "Welcome",
        to: "delivered@resend.dev",
      },
      async () => `provider-${suffix}`
    );
    if (status !== "sent") {
      await ctx.runMutation(components.resend.lib.updateManualEmail, {
        emailId: componentEmailId,
        status,
      });
    }
    const intentId = await ctx.db.insert("welcomeEmailIntents", {
      componentEmailId,
      phase: "enqueued",
      userId,
    });
    return { componentEmailId, intentId };
  });
}

describe("emails/welcome/reconciliation", () => {
  it("retains only component deliveries that account deletion can cancel", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const waiting = await insertEnqueuedIntent(test, "waiting", "waiting");
    const queued = await insertEnqueuedIntent(test, "queued", "queued");
    await insertEnqueuedIntent(test, "sent", "sent");
    await insertEnqueuedIntent(test, "failed", "failed");
    await insertEnqueuedIntent(test, "cancelled", "cancelled");

    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "enqueued" }
    );

    const retained = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").collect()
    );
    expect(retained.map((intent) => intent._id).sort()).toEqual(
      [waiting.intentId, queued.intentId].sort()
    );
  });

  it("releases an intent after component retention removed its record", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const missing = await insertEnqueuedIntent(test, "missing", "failed");
    await test.mutation((ctx) =>
      ctx.runMutation(components.resend.lib.cleanupOldEmails, {
        olderThan: -1,
      })
    );

    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "enqueued" }
    );

    expect(
      await test.query((ctx) =>
        testResend.status(ctx, missing.componentEmailId)
      )
    ).toBeNull();
    expect(
      await test.query((ctx) =>
        ctx.db.get("welcomeEmailIntents", missing.intentId)
      )
    ).toBeNull();
  });

  it("retains an uninspectable handle without blocking healthy rows", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const retained = await insertEnqueuedIntent(test, "uninspectable", "sent");
    const released = await insertEnqueuedIntent(test, "healthy", "sent");
    vi.spyOn(resend, "status").mockRejectedValueOnce(
      new Error("Synthetic component read failure")
    );

    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "enqueued" }
    );

    expect(
      await test.query((ctx) =>
        ctx.db.get("welcomeEmailIntents", retained.intentId)
      )
    ).not.toBeNull();
    expect(
      await test.query((ctx) =>
        ctx.db.get("welcomeEmailIntents", released.intentId)
      )
    ).toBeNull();
  });

  it("continues beyond one hard-bounded page", async () => {
    vi.useFakeTimers();
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    for (let index = 0; index < 33; index += 1) {
      await insertEnqueuedIntent(test, `page-${index}`, "sent");
    }

    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "enqueued" }
    );
    await test.finishAllScheduledFunctions(vi.runAllTimers);

    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").collect())
    ).toEqual([]);
  });
});
