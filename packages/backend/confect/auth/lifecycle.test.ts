import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { authComponent } from "@repo/backend/confect/auth/client";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);

beforeEach(() => {
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-better-auth-secret-for-lifecycle-tests"
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth/lifecycle", () => {
  it("keeps a school account's stored username, and gives it no welcome email or payment customer", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.create({
        model: "user",
        data: {
          createdAt: NOW,
          email: loginAddress("raka_p"),
          emailVerified: false,
          name: "Raka Pratama",
          updatedAt: NOW,
          username: "raka_p",
        },
      });
    });

    const stored = await test.query(async (ctx) => ({
      intents: await ctx.db.query("welcomeEmailIntents").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      users: await ctx.db.query("users").collect(),
    }));
    expect(stored.users).toMatchObject([
      { email: "raka_p@login.nakafa.invalid", username: "raka_p" },
    ]);
    expect(stored.intents).toEqual([]);
    expect(
      Arr.filter(stored.jobs, (job) => job.name.includes("syncCustomer"))
    ).toEqual([]);
  });

  it("projects a school account's new name but gives it no payment customer", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.create({
        data: {
          createdAt: NOW,
          email: loginAddress("raka_p"),
          emailVerified: false,
          name: "Raka Pratama",
          updatedAt: NOW,
          username: "raka_p",
        },
        model: "user",
      });
    });
    const user = await test.query((ctx) => ctx.db.query("users").unique());
    if (!user) {
      throw new Error(
        "Expected the placeholder account to create an app user."
      );
    }
    await test.mutation(async (ctx) => {
      const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
      await adapter.update({
        model: "user",
        update: { name: "Raka P." },
        where: [{ field: "_id", operator: "eq", value: user.authId }],
      });
    });

    const stored = await test.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      user: await ctx.db.get("users", user._id),
    }));
    expect(stored.user).toMatchObject({ name: "Raka P." });
    expect(
      Arr.filter(stored.jobs, (job) => job.name.includes("syncCustomer"))
    ).toEqual([]);
  });
});
