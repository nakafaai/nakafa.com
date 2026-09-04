import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components, internal } from "@repo/backend/convex/_generated/api";
import { authComponent } from "@repo/backend/convex/auth/client";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { createAuthOptions } from "@repo/backend/convex/auth/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { getFunctionName, makeFunctionReference } from "convex/server";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  { authId: string },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");

async function signUpSyntheticLearner(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  suffix: string
) {
  return await test.fetch("/api/auth/sign-up/email", {
    body: JSON.stringify({
      email: `${suffix}@example.com`,
      name: `Synthetic ${suffix}`,
      password: "synthetic-password-12345",
    }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-better-auth-secret-for-lifecycle-tests"
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("auth/client", () => {
  it("creates one awaiting intent through the Better Auth user lifecycle", async () => {
    const test = createConvexTestWithBetterAuth();
    const response = await signUpSyntheticLearner(test, "learner");
    const stored = await test.query(async (ctx) => ({
      intents: await ctx.db.query("welcomeEmailIntents").take(2),
      jobs: await ctx.db.system.query("_scheduled_functions").take(8),
      users: await ctx.db.query("users").take(2),
    }));

    expect(response.status).toBe(200);
    expect(stored.users).toHaveLength(1);
    expect(stored.intents).toHaveLength(1);
    expect(stored.intents[0]).toMatchObject({
      phase: "awaiting-onboarding",
      userId: stored.users[0]?._id,
    });
    expect(stored.users[0]).toMatchObject({
      email: "learner@example.com",
      name: "Synthetic learner",
    });
    expect(stored.users[0]?.welcomeEmailId).toBeUndefined();
    const jobNames = stored.jobs.map(({ name }) => name);
    expect(jobNames).toEqual([
      getFunctionName(internal.customers.actions.internal.syncCustomer),
    ]);
    expect(jobNames).not.toContain(
      getFunctionName(internal.emails.delivery.sendWelcomeEmail)
    );
  });

  it("projects each Better Auth profile field without scheduling unchanged writes", async () => {
    const test = createConvexTestWithBetterAuth();
    await expect(
      signUpSyntheticLearner(test, "profile")
    ).resolves.toMatchObject({
      status: 200,
    });
    const original = await test.query((ctx) => ctx.db.query("users").unique());
    if (!original) {
      throw new Error(
        "Expected the Better Auth lifecycle to create an app user."
      );
    }

    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.update({
        model: "user",
        update: { emailVerified: true },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
      await adapter.update({
        model: "user",
        update: { name: "Updated name" },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
      await adapter.update({
        model: "user",
        update: { image: "https://example.com/avatar.png" },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
      await adapter.update({
        model: "user",
        update: { email: "updated-profile@example.com" },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
    });
    const stored = await test.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      user: await ctx.db.get("users", original._id),
    }));

    expect(stored.user).toMatchObject({
      email: "updated-profile@example.com",
      image: "https://example.com/avatar.png",
      name: "Updated name",
    });
    expect(
      stored.jobs.filter(
        ({ name }) =>
          name ===
          getFunctionName(internal.customers.actions.internal.syncCustomer)
      )
    ).toHaveLength(4);
  });

  it("ignores profile propagation after deletion preparation begins", async () => {
    const test = createConvexTestWithBetterAuth();
    await signUpSyntheticLearner(test, "deleting");
    const original = await test.query((ctx) => ctx.db.query("users").unique());
    if (!original) {
      throw new Error(
        "Expected the Better Auth lifecycle to create an app user."
      );
    }
    await test.mutation((ctx) =>
      ctx.db.patch(original._id, { deletionPreparedAt: NOW })
    );

    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.update({
        model: "user",
        update: { name: "Must not propagate" },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
    });
    const stored = await test.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      user: await ctx.db.get("users", original._id),
    }));

    expect(stored.user?.name).toBe("Synthetic deleting");
    expect(stored.jobs).toHaveLength(1);
  });

  it("ignores Better Auth users that do not have an app projection", async () => {
    const test = createConvexTestWithBetterAuth();
    const authUser = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          data: {
            createdAt: NOW,
            email: "component-only@example.com",
            emailVerified: true,
            name: "Component only",
            updatedAt: NOW,
          },
          model: "user",
        },
        select: ["_id"],
      })
    );

    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.update({
        model: "user",
        update: { name: "Still component only" },
        where: [{ field: "_id", operator: "eq", value: authUser._id }],
      });
    });

    await expect(
      test.query((ctx) => ctx.db.query("users").unique())
    ).resolves.toBeNull();
  });

  it("preserves an explicit profile image during adapter-driven creation", async () => {
    const test = createConvexTestWithBetterAuth();

    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.create({
        data: {
          createdAt: NOW,
          email: "image@example.com",
          emailVerified: true,
          image: "https://example.com/created-avatar.png",
          name: "Image learner",
          updatedAt: NOW,
        },
        model: "user",
      });
    });

    await expect(
      test.query((ctx) => ctx.db.query("users").unique())
    ).resolves.toMatchObject({
      image: "https://example.com/created-avatar.png",
    });
  });

  it("schedules both immediate and recovery cleanup after auth deletion", async () => {
    const test = createConvexTestWithBetterAuth();
    await signUpSyntheticLearner(test, "deleted");
    const original = await test.query((ctx) => ctx.db.query("users").unique());
    if (!original) {
      throw new Error(
        "Expected the Better Auth lifecycle to create an app user."
      );
    }

    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.delete({
        model: "user",
        where: [{ field: "_id", operator: "eq", value: original.authId }],
      });
    });
    const cleanupJobs = await test.query(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter(
        ({ name }) =>
          name === getFunctionName(finalizeDeletedUserCleanupReference)
      )
    );

    expect(cleanupJobs).toEqual([
      expect.objectContaining({
        args: [{ authId: original.authId }],
        scheduledTime: NOW,
      }),
      expect.objectContaining({
        args: [{ authId: original.authId }],
        scheduledTime: NOW + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
      }),
    ]);
  });
});
