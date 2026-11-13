import { DatabaseReader, RegisteredConvexFunction } from "@confect/server";
import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { resend } from "@repo/backend/confect/emails/client";
import {
  activateWelcomeIntent,
  declareWelcomeIntent,
  removeWelcomeIntent,
} from "@repo/backend/confect/emails/welcome/impl";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/confect/emails/welcome/spec";
import { runWelcomeEmailDelivery } from "@repo/backend/confect/emails/welcome/workflow";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import type { FunctionArgs } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

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
      credits: 0,
      creditsResetAt: 0,
      email: "delivered@resend.dev",
      mascot: MASCOT_CODE,
      name: "Synthetic Test Learner",
      plan: "free",
    });
    const intentId = await Effect.runPromise(
      declareWelcomeIntent(userId).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
        )
      )
    );
    await Effect.runPromise(
      activateWelcomeIntent(userId, "id").pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
        )
      )
    );
    return {
      intentId,
      userId,
    };
  });
}
async function completeWelcomeWorkflow(
  test: TestConvex<typeof schema>,
  intentId: Awaited<ReturnType<typeof createActivatedIntent>>["intentId"],
  runResult: FunctionArgs<
    typeof components.workflow.workflow.complete
  >["runResult"]
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
    const result = await runWelcomeEmailDelivery(
      {
        runAction,
      },
      {
        intentId,
      }
    );
    expect(result).toBeNull();
    expect(runAction).toHaveBeenCalledExactlyOnceWith(
      internal.emails.welcome.delivery.sendWelcomeEmail,
      {
        intentId,
      },
      {
        retry: WELCOME_EMAIL_RETRY,
      }
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
      Effect.runPromise(
        DatabaseReader.make(databaseSchema, ctx.db)
          .table("welcomeEmailIntents")
          .get(intentId)
          .pipe(
            Effect.orDie,
            Effect.provide(DatabaseReader.layer(databaseSchema, ctx.db))
          )
      )
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
    ).toMatchObject({
      phase: "enqueued",
      workflowId,
    });
    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      {
        cursor: null,
        phase: "enqueued",
      }
    );
    const completedIntent = await test.query((ctx) =>
      ctx.db.get("welcomeEmailIntents", intentId)
    );
    expect(completedIntent).toMatchObject({
      phase: "enqueued",
    });
    expect(completedIntent).not.toHaveProperty("workflowId");
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.workflow.workflow.getStatus, {
          workflowId,
        })
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
    ).toMatchObject({
      phase: "scheduled",
      workflowId,
    });
    await test.mutation(
      internal.emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle,
      {
        cursor: null,
        phase: "scheduled",
      }
    );
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intentId))
    ).toBeNull();
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.workflow.workflow.getStatus, {
          workflowId,
        })
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
      {
        intentId,
      }
    );
    const send = vi.spyOn(resend, "sendEmail");
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
          )
        )
      )
    );
    await expect(
      test.query(internal.emails.welcome.internal.readIntentInput, {
        intentId,
      })
    ).resolves.toBeNull();
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
        credits: 0,
        creditsResetAt: 0,
        email: "delivered@resend.dev",
        mascot: MASCOT_CODE,
        name: "Synthetic Awaiting Learner",
        plan: "free",
      })
    );
    const intentId = await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
          )
        )
      )
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
    ).toMatchObject({
      phase: "awaiting-onboarding",
    });
  });
  it.each([
    ["is gone", "gone"],
    ["deleted the account", "deleted"],
  ] as const)("drops a scheduled intent when its owner %s before enqueue", async (_case, cause) => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    workflowTest.register(test);
    const { intentId, userId } = await createActivatedIntent(
      test,
      `${cause}-before-enqueue`
    );
    await test.mutation((ctx) =>
      cause === "gone"
        ? ctx.db.delete(userId)
        : ctx.db.patch("users", userId, { deletedAt: NOW })
    );
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
});
