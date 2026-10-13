import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { authComponent } from "@repo/backend/confect/auth/client";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { signInWithGoogle } from "@repo/backend/test/auth";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
  },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-better-auth-secret-for-lifecycle-tests"
  );
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("auth/client", () => {
  it("creates one awaiting intent through the Better Auth user lifecycle", async () => {
    const test = createConvexTestWithBetterAuth();
    const response = await signInWithGoogle(test, "learner", NOW);
    const stored = await test.query(async (ctx) => ({
      intents: await ctx.db.query("welcomeEmailIntents").take(2),
      jobs: await ctx.db.system.query("_scheduled_functions").take(8),
      users: await ctx.db.query("users").take(2),
    }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/en");
    expect(stored.users).toHaveLength(1);
    expect(stored.intents).toHaveLength(1);
    expect(stored.intents[0]).toMatchObject({
      phase: "awaiting-onboarding",
      userId: stored.users[0]?._id,
    });
    expect(stored.users[0]).toMatchObject({
      email: "learner@example.com",
      image: "https://example.com/learner.png",
      name: "Synthetic learner",
      username: "syntheticlearner",
    });
    const jobNames = Arr.map(stored.jobs, ({ name }) => name);
    expect(jobNames).toEqual([
      getFunctionName(internal.customers.actions.internal.syncCustomer),
    ]);
  });
  it("gives a new account the username of its name, numbered when another account holds it", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-holder",
        credits: 0,
        creditsResetAt: 0,
        email: "holder@example.com",
        name: "Holder",
        plan: "free",
        username: "syntheticlearner",
      })
    );

    await signInWithGoogle(test, "learner", NOW);

    const users = await test.query((ctx) => ctx.db.query("users").collect());
    expect(Arr.map(users, ({ username }) => username)).toEqual([
      "syntheticlearner",
      "syntheticlearner2",
    ]);
  });
  it("projects each Better Auth profile field without scheduling unchanged writes", async () => {
    const test = createConvexTestWithBetterAuth();
    await expect(signInWithGoogle(test, "profile", NOW)).resolves.toMatchObject(
      {
        status: 302,
      }
    );
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
        update: {
          emailVerified: true,
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
      await adapter.update({
        model: "user",
        update: {
          name: "Updated name",
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
      await adapter.update({
        model: "user",
        update: {
          image: "https://example.com/avatar.png",
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
      await adapter.update({
        model: "user",
        update: {
          email: "updated-profile@example.com",
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
      await adapter.update({
        model: "user",
        update: {
          image: null,
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
    });
    const stored = await test.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      user: await ctx.db.get("users", original._id),
    }));
    expect(stored.user).toMatchObject({
      email: "updated-profile@example.com",
      name: "Updated name",
    });
    expect(stored.user).not.toHaveProperty("image");
    expect(
      Arr.filter(
        stored.jobs,
        ({ name }) =>
          name ===
          getFunctionName(internal.customers.actions.internal.syncCustomer)
      )
    ).toHaveLength(5);
  });
  it("ignores profile propagation after deletion preparation begins", async () => {
    const test = createConvexTestWithBetterAuth();
    await signInWithGoogle(test, "deleting", NOW);
    const original = await test.query((ctx) => ctx.db.query("users").unique());
    if (!original) {
      throw new Error(
        "Expected the Better Auth lifecycle to create an app user."
      );
    }
    await test.mutation((ctx) =>
      ctx.db.patch(original._id, {
        deletionPreparedAt: NOW,
      })
    );
    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.update({
        model: "user",
        update: {
          name: "Must not propagate",
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
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
        update: {
          name: "Still component only",
        },
        where: [
          {
            field: "_id",
            operator: "eq",
            value: authUser._id,
          },
        ],
      });
    });
    await expect(
      test.query((ctx) => ctx.db.query("users").unique())
    ).resolves.toBeNull();
  });
  it("omits an absent profile image during adapter-driven creation", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.create({
        data: {
          createdAt: NOW,
          email: "image@example.com",
          emailVerified: true,
          name: "Image learner",
          updatedAt: NOW,
        },
        model: "user",
      });
    });
    const user = await test.query((ctx) => ctx.db.query("users").unique());
    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty("image");
  });
  it("schedules both immediate and recovery cleanup after auth deletion", async () => {
    const test = createConvexTestWithBetterAuth();
    await signInWithGoogle(test, "deleted", NOW);
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
        where: [
          {
            field: "_id",
            operator: "eq",
            value: original.authId,
          },
        ],
      });
    });
    const cleanupJobs = await test.query(async (ctx) =>
      Arr.filter(
        await ctx.db.system.query("_scheduled_functions").collect(),
        ({ name }) =>
          name === getFunctionName(finalizeDeletedUserCleanupReference)
      )
    );
    expect(cleanupJobs).toEqual([
      expect.objectContaining({
        args: [
          {
            authId: original.authId,
          },
        ],
        scheduledTime: NOW,
      }),
      expect.objectContaining({
        args: [
          {
            authId: original.authId,
          },
        ],
        scheduledTime: NOW + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
      }),
    ]);
  });
});
