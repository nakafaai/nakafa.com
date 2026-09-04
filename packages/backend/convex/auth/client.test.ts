import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components, internal } from "@repo/backend/convex/_generated/api";
import { authComponent } from "@repo/backend/convex/auth/client";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { createAuthOptions } from "@repo/backend/convex/auth/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { getFunctionName, makeFunctionReference } from "convex/server";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const BASE64_PADDING_PATTERN = /[=]+$/;
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  { authId: string },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");

function encodeGoogleTokenPart(value: object) {
  return btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_PADDING_PATTERN, "");
}

function createGoogleIdToken(suffix: string) {
  const issuedAt = Math.floor(NOW / 1000);

  return [
    encodeGoogleTokenPart({ alg: "none", typ: "JWT" }),
    encodeGoogleTokenPart({
      aud: "test-google-client",
      email: `${suffix}@example.com`,
      email_verified: true,
      exp: issuedAt + 3600,
      iat: issuedAt,
      iss: "https://accounts.google.com",
      name: `Synthetic ${suffix}`,
      picture: `https://example.com/${suffix}.png`,
      sub: `google-${suffix}`,
    }),
    "test-signature",
  ].join(".");
}

async function signUpGoogleLearner(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  suffix: string
) {
  const tokenExchange = vi.fn<typeof fetch>((input, init) => {
    expect(String(input)).toBe(GOOGLE_TOKEN_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("code=synthetic-authorization-code");

    return Promise.resolve(
      Response.json({
        access_token: `access-${suffix}`,
        expires_in: 3600,
        id_token: createGoogleIdToken(suffix),
        refresh_token: `refresh-${suffix}`,
        scope: "openid email profile",
        token_type: "Bearer",
      })
    );
  });
  vi.stubGlobal("fetch", tokenExchange);

  const signInResponse = await test.fetch("/api/auth/sign-in/social", {
    body: JSON.stringify({
      callbackURL: "/en",
      provider: "google",
    }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
  const authorizationLocation = signInResponse.headers.get("location");
  if (!authorizationLocation) {
    throw new Error("Expected Google authorization redirect.");
  }
  const state = new URL(authorizationLocation).searchParams.get("state");
  if (!state) {
    throw new Error("Expected Google authorization state.");
  }
  const cookie = signInResponse.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");

  const response = await test.fetch(
    `/api/auth/callback/google?${new URLSearchParams({
      code: "synthetic-authorization-code",
      state,
    })}`,
    { headers: { cookie } }
  );

  expect(tokenExchange).toHaveBeenCalledOnce();
  return response;
}

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
    const response = await signUpGoogleLearner(test, "learner");
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
    await expect(signUpGoogleLearner(test, "profile")).resolves.toMatchObject({
      status: 302,
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
      await adapter.update({
        model: "user",
        update: { image: null },
        where: [{ field: "_id", operator: "eq", value: original.authId }],
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
      stored.jobs.filter(
        ({ name }) =>
          name ===
          getFunctionName(internal.customers.actions.internal.syncCustomer)
      )
    ).toHaveLength(5);
  });

  it("ignores profile propagation after deletion preparation begins", async () => {
    const test = createConvexTestWithBetterAuth();
    await signUpGoogleLearner(test, "deleting");
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
    await signUpGoogleLearner(test, "deleted");
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
