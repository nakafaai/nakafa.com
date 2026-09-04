import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { components, internal } from "@repo/backend/convex/_generated/api";
import { resend } from "@repo/backend/convex/emails/client";
import {
  activateWelcomeIntent,
  declareWelcomeIntent,
  removeWelcomeIntent,
} from "@repo/backend/convex/emails/welcome/impl";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/convex/emails/welcome/spec";
import { runWelcomeEmailDelivery } from "@repo/backend/convex/emails/welcome/workflow";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.UTC(2026, 8, 4, 8, 0, 0);
const testResend = new Resend(components.resend, {
  apiKey: "re_test_welcome_delivery",
  testMode: true,
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function createActivatedIntent(
  test: TestConvex<typeof schema>,
  suffix: string
) {
  return await test.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx, ["page"]);
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      await insertTestPage(
        ctx,
        locale,
        "privacy-policy",
        locale === "id" ? "privasi" : `privacy-${locale}`
      );
      await insertTestPage(
        ctx,
        locale,
        "terms-of-service",
        locale === "id" ? "ketentuan" : `terms-${locale}`
      );
    }
    const userId = await ctx.db.insert("users", {
      authId: `${suffix}-welcome-owner`,
      credits: 0,
      creditsResetAt: 0,
      email: "delivered@resend.dev",
      name: "Synthetic Test Learner",
      plan: "free",
    });
    const intentId = await runConvexProgram(declareWelcomeIntent(ctx, userId));
    await runConvexProgram(activateWelcomeIntent(ctx, userId, "id"));
    return { intentId, userId };
  });
}

async function completeWelcomeWorkflow(
  test: TestConvex<typeof schema>,
  intentId: Awaited<ReturnType<typeof createActivatedIntent>>["intentId"],
  runResult:
    | { kind: "success"; returnValue: null }
    | { error: string; kind: "failed" }
) {
  const intent = await test.query((ctx) =>
    ctx.db.get("welcomeEmailIntents", intentId)
  );
  if (!(intent && "workflowId" in intent && intent.workflowId)) {
    throw new Error("Expected one synthetic workflow handle.");
  }
  const workflowId = intent.workflowId;
  const workflowState = await test.query((ctx) =>
    ctx.runQuery(components.workflow.workflow.getStatus, {
      workflowId,
    })
  );
  await test.mutation((ctx) =>
    ctx.runMutation(components.workflow.workflow.complete, {
      generationNumber: workflowState.workflow.generationNumber,
      runResult,
      workflowId,
    })
  );
  return workflowId;
}

describe("emails/welcome/delivery", () => {
  it("runs the provider action with the deletion-aware retry policy", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const { intentId } = await createActivatedIntent(test, "workflow");
    const runAction = vi.fn(async () => null);

    const result = await runWelcomeEmailDelivery({ runAction }, { intentId });

    expect(result).toBeNull();
    expect(runAction).toHaveBeenCalledExactlyOnceWith(
      internal.emails.welcome.delivery.sendWelcomeEmail,
      { intentId },
      { retry: WELCOME_EMAIL_RETRY }
    );
  });

  it("enqueues one localized provider message across action retries", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(test, "localized");

    await test.action(internal.emails.welcome.delivery.sendWelcomeEmail, {
      intentId,
    });
    const firstDelivery = await test.query((ctx) =>
      ctx.db.get("welcomeEmailIntents", intentId)
    );
    if (firstDelivery?.phase !== "enqueued") {
      throw new Error("Expected an enqueued synthetic intent.");
    }
    await test.action(internal.emails.welcome.delivery.sendWelcomeEmail, {
      intentId,
    });
    const email = await test.query((ctx) =>
      testResend.get(ctx, firstDelivery.componentEmailId)
    );
    const stored = await test.query((ctx) =>
      ctx.db.get("welcomeEmailIntents", intentId)
    );

    expect(email).toMatchObject({
      subject: "Akun Nakafa kamu sudah siap",
      to: ["delivered@resend.dev"],
    });
    expect(email?.html).toContain("http://localhost:3000/id/home");
    expect(email?.html).toContain("http://localhost:3000/id/privasi");
    expect(email?.html).toContain("http://localhost:3000/id/ketentuan");
    expect(email?.html).not.toContain("Synthetic Test Learner");
    expect(email?.text).not.toContain("Synthetic Test Learner");
    expect(stored).toMatchObject({
      phase: "enqueued",
      componentEmailId: firstDelivery.componentEmailId,
      userId,
    });
  });

  it("reconciles successful workflow storage without a completion callback", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId } = await createActivatedIntent(test, "completed");
    await test.action(internal.emails.welcome.delivery.sendWelcomeEmail, {
      intentId,
    });

    const workflowId = await completeWelcomeWorkflow(test, intentId, {
      kind: "success",
      returnValue: null,
    });
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "enqueued", workflowId });
    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "enqueued" }
    );

    const completedIntent = await test.query((ctx) =>
      ctx.db.get("welcomeEmailIntents", intentId)
    );
    expect(completedIntent).toMatchObject({ phase: "enqueued" });
    expect(completedIntent).not.toHaveProperty("workflowId");
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.workflow.workflow.getStatus, { workflowId })
      )
    ).rejects.toThrow();
  });

  it("reconciles a failed workflow after its completion callback was missed", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const { intentId } = await createActivatedIntent(test, "failed");

    const workflowId = await completeWelcomeWorkflow(test, intentId, {
      error: "Synthetic failure",
      kind: "failed",
    });
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "scheduled", workflowId });
    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      { cursor: null, phase: "scheduled" }
    );

    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toBeNull();
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.workflow.workflow.getStatus, { workflowId })
      )
    ).rejects.toThrow();
  });

  it("rechecks account eligibility in the enqueue transaction", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(test, "deleted");
    const input = await test.query(
      internal.emails.welcome.internal.readIntentInput,
      { intentId }
    );
    const send = vi.spyOn(resend, "sendEmail");

    await test.mutation((ctx) =>
      runConvexProgram(removeWelcomeIntent(ctx, userId))
    );
    await test.mutation(
      internal.emails.welcome.internal.enqueueRenderedWelcome,
      {
        intentId,
        html: "<p>Welcome</p>",
        subject: "Welcome",
        text: "Welcome",
      }
    );

    expect(input).not.toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });

  it("ignores a rendered retry after the intent left the scheduled phase", async () => {
    const test = convexTest(schema, convexModules);
    const userId = await test.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "awaiting-render-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "delivered@resend.dev",
        name: "Synthetic Awaiting Learner",
        plan: "free",
      })
    );
    const intentId = await test.mutation((ctx) =>
      runConvexProgram(declareWelcomeIntent(ctx, userId))
    );
    const send = vi.spyOn(resend, "sendEmail");

    await test.mutation(
      internal.emails.welcome.internal.enqueueRenderedWelcome,
      {
        intentId,
        html: "<p>Account ready</p>",
        subject: "Account ready",
        text: "Account ready",
      }
    );

    expect(send).not.toHaveBeenCalled();
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "awaiting-onboarding" });
  });

  it("drops a scheduled intent when its owner was deleted before enqueue", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(
      test,
      "deleted-before-enqueue"
    );
    await test.mutation((ctx) => ctx.db.delete(userId));
    const send = vi.spyOn(resend, "sendEmail");

    expect(
      await test.query(internal.emails.welcome.internal.readIntentInput, {
        intentId,
      })
    ).toBeNull();
    await test.mutation(
      internal.emails.welcome.internal.enqueueRenderedWelcome,
      {
        intentId,
        html: "<p>Account ready</p>",
        subject: "Account ready",
        text: "Account ready",
      }
    );

    expect(send).not.toHaveBeenCalled();
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toBeNull();
  });

  it("defers enqueue when deletion starts after the message was rendered", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(
      test,
      "deletion-after-render"
    );
    await test.mutation((ctx) =>
      ctx.db.patch("users", userId, { deletionPreparedAt: NOW })
    );
    const send = vi.spyOn(resend, "sendEmail");

    await expect(
      test.mutation(internal.emails.welcome.internal.enqueueRenderedWelcome, {
        intentId,
        html: "<p>Account ready</p>",
        subject: "Account ready",
        text: "Account ready",
      })
    ).rejects.toThrow();

    expect(send).not.toHaveBeenCalled();
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "scheduled" });
  });

  it("defers during reversible deletion and delivers after cancellation", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(
      test,
      "deletion-deferred"
    );
    await test.mutation((ctx) =>
      ctx.db.patch("users", userId, { deletionPreparedAt: NOW })
    );

    await expect(
      test.action(internal.emails.welcome.delivery.sendWelcomeEmail, {
        intentId,
      })
    ).rejects.toThrow();
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "scheduled" });

    await test.mutation((ctx) =>
      ctx.db.patch("users", userId, { deletionPreparedAt: undefined })
    );
    await test.action(internal.emails.welcome.delivery.sendWelcomeEmail, {
      intentId,
    });

    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toMatchObject({ phase: "enqueued" });
  });
});
