import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { type Auth, createAuth } from "@repo/backend/confect/auth/runtime";
import { loginAddress } from "@repo/backend/confect/identity/address";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import {
  cookieHeader,
  googleFetch,
  signInWithGoogle,
} from "@repo/backend/test/auth";
import { encodeJsonText } from "@repo/utilities/json";
import { isAPIError } from "better-auth/api";
import { symmetricEncrypt } from "better-auth/crypto";
import { Effect, Record as Rec } from "effect";

const NOW = Date.UTC(2026, 9, 13, 12);
const HOUR = 60 * 60 * 1000;
const SITE_URL = "http://localhost:3000";
const STORED_ACCESS_TOKEN = "ya29.stored-before-the-hooks";
const STORED_REFRESH_TOKEN = "1//stored-before-the-hooks";
const SCHOOL_PASSWORD = "correct horse battery";

type Test = ReturnType<typeof createConvexTestWithBetterAuth>;

/**
 * Seeds a school account that holds a password: a Better Auth user with a
 * username and a credential account with the hash of the password. The app
 * user row comes from the same create, through the auth triggers.
 */
function seedSchoolPassword(test: Test) {
  return test.mutation(async (ctx) => {
    const context = await Effect.runPromise(
      createAuth(ctx).pipe(
        Effect.flatMap((auth) => Effect.promise(() => auth.$context))
      )
    );
    const user = await context.internalAdapter.createUser({
      email: loginAddress("budi"),
      emailVerified: false,
      name: "Budi",
      username: "budi",
    });
    await context.internalAdapter.createAccount({
      accountId: user.id,
      password: await context.password.hash(SCHOOL_PASSWORD),
      providerId: "credential",
      userId: user.id,
    });
  });
}

/**
 * A learner whose Google account holds the tokens that an older sign-in stored,
 * sealed with the secret the way Better Auth seals them. Returns the learner's
 * Better Auth user id.
 */
function seedStoredTokens(test: Test) {
  return test.mutation(async (ctx) => {
    const { authUserId } = await seedAuthenticatedUser(ctx, { now: NOW });
    const { secretConfig } = await Effect.runPromise(
      createAuth(ctx).pipe(
        Effect.flatMap((auth) => Effect.promise(() => auth.$context))
      )
    );
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        data: {
          accessToken: await symmetricEncrypt({
            data: STORED_ACCESS_TOKEN,
            key: secretConfig,
          }),
          accessTokenExpiresAt: NOW + HOUR,
          accountId: "google-stored",
          createdAt: NOW,
          providerId: "google",
          refreshToken: await symmetricEncrypt({
            data: STORED_REFRESH_TOKEN,
            key: secretConfig,
          }),
          scope: "openid,email,profile",
          updatedAt: NOW,
          userId: authUserId,
        },
        model: "account",
      },
    });
    return authUserId;
  });
}

/**
 * Calls a route from server code, the way `auth.api` does. Returns the code and
 * status of the refusal, or null when the route answered.
 */
function callFromServer(
  test: Test,
  call: (api: Auth["api"]) => Promise<unknown>
) {
  return test.mutation((ctx) =>
    createAuth(ctx).pipe(
      Effect.flatMap((auth) =>
        Effect.tryPromise(() => call(auth.api)).pipe(
          Effect.matchEffect({
            onFailure: ({ cause }) =>
              isAPIError(cause)
                ? Effect.succeed({
                    code: cause.body?.code ?? null,
                    status: cause.statusCode,
                  })
                : Effect.die(cause),
            onSuccess: () => Effect.succeed(null),
          })
        )
      ),
      Effect.runPromise
    )
  );
}

/** The two sign-in routes that take a password, called from server code with the right password. */
const passwordSignInCalls: Record<
  string,
  (api: Auth["api"]) => Promise<unknown>
> = {
  signInEmail: (api) =>
    api.signInEmail({
      body: { email: loginAddress("budi"), password: SCHOOL_PASSWORD },
    }),
  signInUsername: (api) =>
    api.signInUsername({
      body: { password: SCHOOL_PASSWORD, username: "budi" },
    }),
};

/** The three routes that read a stored token, as a server would call them for a learner. */
const serverCalls: Record<
  string,
  (api: Auth["api"], userId: string) => Promise<unknown>
> = {
  accountInfo: (api, userId) =>
    api.accountInfo({
      query: { accountId: "google-stored", providerId: "google", userId },
    }),
  getAccessToken: (api, userId) =>
    api.getAccessToken({ body: { providerId: "google", userId } }),
  refreshToken: (api, userId) =>
    api.refreshToken({ body: { providerId: "google", userId } }),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-better-auth-secret-for-route-tests"
  );
  // A route that reached Google would call the stand-in, never the network.
  googleFetch.mockReset();
  vi.stubGlobal("fetch", googleFetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth/routes", () => {
  it.each([
    ["POST", "/api/auth/get-access-token"],
    ["POST", "/api/auth/refresh-token"],
    ["GET", "/api/auth/account-info"],
  ])(
    "returns 404 for the route %s %s that would read a stored provider token",
    async (method, path) => {
      const test = createConvexTestWithBetterAuth();
      const response = await test.fetch(path, {
        headers: { origin: SITE_URL },
        method,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    }
  );

  it.each(Rec.toEntries(serverCalls))(
    "refuses %s from server code too, so an old token cannot be read",
    async (_route, call) => {
      const test = createConvexTestWithBetterAuth();
      const userId = await seedStoredTokens(test);
      expect(await callFromServer(test, (api) => call(api, userId))).toEqual({
        code: "PROVIDER_TOKENS_NOT_STORED",
        status: 404,
      });
      expect(googleFetch).not.toHaveBeenCalled();
    }
  );

  it.each(Rec.toEntries(passwordSignInCalls))(
    "refuses %s from server code even with the right password, so no session opens",
    async (_route, call) => {
      const test = createConvexTestWithBetterAuth();
      await seedSchoolPassword(test);
      expect(await callFromServer(test, call)).toEqual({
        code: "PASSWORD_SIGN_IN_DISABLED",
        status: 404,
      });
    }
  );

  it("refuses a username that a signed-in account sends to update-user, so no second username is stored", async () => {
    const test = createConvexTestWithBetterAuth();
    const session = await signInWithGoogle(test, "renamer", NOW);
    const response = await test.fetch("/api/auth/update-user", {
      body: encodeJsonText({ username: "admin" }),
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(session),
        origin: SITE_URL,
      },
      method: "POST",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "USERNAME_UPDATE_DISABLED",
    });
    const user = await test.query((ctx) => ctx.db.query("users").unique());
    if (!user) {
      throw new Error("Expected the Google sign-in to create an app user.");
    }
    expect(user.username).toBe("syntheticrenamer");
    const authUser = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: user.authId }],
      })
    );
    expect(authUser?.username ?? null).toBeNull();
  });

  it("still lets a signed-in account change its name through update-user", async () => {
    const test = createConvexTestWithBetterAuth();
    const session = await signInWithGoogle(test, "renamer", NOW);
    const response = await test.fetch("/api/auth/update-user", {
      body: encodeJsonText({ name: "Renamed learner" }),
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(session),
        origin: SITE_URL,
      },
      method: "POST",
    });
    expect(response.status).toBe(200);
    const user = await test.query((ctx) => ctx.db.query("users").unique());
    expect(user?.name).toBe("Renamed learner");
  });
});
