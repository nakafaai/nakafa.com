import { RegisteredConvexFunction } from "@confect/server";
import { Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  activateWelcomeIntent,
  declareWelcomeIntent,
  removeWelcomeIntent,
} from "@repo/backend/confect/emails/welcome/impl";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import schema from "@repo/backend/convex/schema";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

const testResend = new Resend(components.resend, {
  apiKey: "re_test_welcome_intent",
  testMode: true,
});
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
async function insertUser(test: TestConvex<typeof schema>, suffix: string) {
  return await test.mutation((ctx) =>
    ctx.db.insert("users", {
      authId: `${suffix}-auth`,
      credits: 0,
      creditsResetAt: 0,
      email: `${suffix}@example.com`,
      name: `Synthetic ${suffix}`,
      plan: "free",
    })
  );
}
describe("emails/welcome/impl", () => {
  it("declares exactly one intent per new app user", async () => {
    const test = convexTest(schema, convexModules);
    const userId = await insertUser(test, "declared");
    const firstId = await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const repeatedId = await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const intents = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").collect()
    );
    expect(repeatedId).toBe(firstId);
    expect(intents).toEqual([
      expect.objectContaining({
        phase: "awaiting-onboarding",
        userId,
      }),
    ]);
  });
  it("does not create an intent for a historical user during activation", async () => {
    const test = convexTest(schema, convexModules);
    const userId = await insertUser(test, "historical");
    const activated = await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "en").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(activated).toBe(false);
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });
  it("activates one durable workflow with the completed locale", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const userId = await insertUser(test, "activated");
    await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const first = await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "id").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const repeated = await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "de").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const intent = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").unique()
    );
    expect(first).toBe(true);
    expect(repeated).toBe(false);
    expect(intent).toMatchObject({
      locale: "id",
      phase: "scheduled",
      userId,
      workflowId: expect.any(String),
    });
  });
  it("removes an intent that has not started", async () => {
    const test = convexTest(schema, convexModules);
    const userId = await insertUser(test, "awaiting-delete");
    await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });
  it("fails closed when a stored workflow handle has no component record", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const userId = await insertUser(test, "missing-workflow");
    await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "en").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const intent = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").unique()
    );
    if (intent?.phase !== "scheduled") {
      throw new Error("Expected one scheduled synthetic intent.");
    }
    await test.mutation((ctx) =>
      ctx.runMutation(components.workflow.workflow.cleanup, {
        force: true,
        workflowId: intent.workflowId,
      })
    );
    await expect(
      test.mutation((ctx) =>
        Effect.runPromise(
          removeWelcomeIntent(userId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toThrow();
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toMatchObject({
      phase: "scheduled",
      workflowId: intent.workflowId,
    });
  });
  it("cancels and cleans a live workflow before removing its intent", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const userId = await insertUser(test, "live-workflow-delete");
    await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "en").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const intent = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").unique()
    );
    if (intent?.phase !== "scheduled") {
      throw new Error("Expected one scheduled synthetic intent.");
    }
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.workflow.workflow.getStatus, {
          workflowId: intent.workflowId,
        })
      )
    ).rejects.toThrow();
  });
  it("retains the intent when its terminal workflow cannot be cleaned", async () => {
    const test = convexTest(schema, convexModules);
    workflowTest.register(test);
    const userId = await insertUser(test, "uncleanable-workflow");
    await test.mutation((ctx) =>
      Effect.runPromise(
        declareWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        activateWelcomeIntent(userId, "en").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const intent = await test.query((ctx) =>
      ctx.db.query("welcomeEmailIntents").unique()
    );
    if (intent?.phase !== "scheduled") {
      throw new Error("Expected one scheduled synthetic intent.");
    }
    vi.spyOn(workflow, "status").mockResolvedValueOnce({
      result: null,
      type: "completed",
    });
    vi.spyOn(workflow, "cleanup").mockResolvedValueOnce(false);
    await expect(
      test.mutation((ctx) =>
        Effect.runPromise(
          removeWelcomeIntent(userId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toThrow("Unable to clean the welcome email workflow.");
    expect(
      await test.query((ctx) => ctx.db.get("welcomeEmailIntents", intent._id))
    ).toMatchObject({
      phase: "scheduled",
      workflowId: intent.workflowId,
    });
  });
  it("cancels a queued component email before removing its intent", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const userId = await insertUser(test, "queued-delete");
    const componentEmailId = await test.mutation((ctx) =>
      testResend.sendEmail(ctx, {
        from: "Nakafa <nakafa@notifications.nakafa.com>",
        subject: "Welcome",
        text: "Welcome",
        to: "delivered@resend.dev",
      })
    );
    await test.mutation((ctx) =>
      ctx.db.insert("welcomeEmailIntents", {
        componentEmailId,
        phase: "enqueued",
        userId,
      })
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(
      await test.query((ctx) => testResend.status(ctx, componentEmailId))
    ).toMatchObject({
      status: "cancelled",
    });
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });
  it("removes an intent after its component record was already cleaned", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const userId = await insertUser(test, "cleaned-delete");
    const componentEmailId = await test.mutation((ctx) =>
      testResend.sendEmail(ctx, {
        from: "Nakafa <nakafa@notifications.nakafa.com>",
        subject: "Welcome",
        text: "Welcome",
        to: "delivered@resend.dev",
      })
    );
    await test.mutation((ctx) =>
      ctx.db.insert("welcomeEmailIntents", {
        componentEmailId,
        phase: "enqueued",
        userId,
      })
    );
    await test.mutation((ctx) =>
      ctx.runMutation(components.resend.lib.cleanupAbandonedEmails, {
        olderThan: -1,
      })
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });
  it("removes app state without mutating a finalized component record", async () => {
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    const userId = await insertUser(test, "sent-delete");
    const componentEmailId = await test.mutation((ctx) =>
      testResend.sendEmailManually(
        ctx,
        {
          from: "Nakafa <nakafa@notifications.nakafa.com>",
          subject: "Welcome",
          to: "delivered@resend.dev",
        },
        async () => "synthetic-resend-id"
      )
    );
    await test.mutation((ctx) =>
      ctx.db.insert("welcomeEmailIntents", {
        componentEmailId,
        phase: "enqueued",
        userId,
      })
    );
    await test.mutation((ctx) =>
      Effect.runPromise(
        removeWelcomeIntent(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(
      await test.query((ctx) => testResend.status(ctx, componentEmailId))
    ).toMatchObject({
      status: "sent",
    });
    expect(
      await test.query((ctx) => ctx.db.query("welcomeEmailIntents").unique())
    ).toBeNull();
  });
});
