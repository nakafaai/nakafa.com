import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { type Auth, createAuth } from "@repo/backend/confect/auth/runtime";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { googleFetch } from "@repo/backend/test/auth";
import { isAPIError } from "better-auth/api";
import { symmetricEncrypt } from "better-auth/crypto";
import { Effect, Record as Rec } from "effect";

const NOW = Date.UTC(2026, 9, 13, 12);
const HOUR = 60 * 60 * 1000;
const SITE_URL = "http://localhost:3000";
const STORED_ACCESS_TOKEN = "ya29.stored-before-the-hooks";
const STORED_REFRESH_TOKEN = "1//stored-before-the-hooks";

type Test = ReturnType<typeof createConvexTestWithBetterAuth>;

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
});
