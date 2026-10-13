import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  cookieHeader,
  createGoogleIdToken,
  expectNoProviderTokens,
  GOOGLE_KEY,
  signInWithGoogle,
  storedAccounts,
} from "@repo/backend/test/auth";
import { encodeJsonText } from "@repo/utilities/json";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { Array as Arr, DateTime, Record as Rec } from "effect";

const NOW = Date.UTC(2026, 9, 13, 12);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SCOPE = "openid email profile";
const SITE_URL = "http://localhost:3000";

type Test = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Better Auth's context over the test component, built from the options that production uses. */
function betterAuthContext(ctx: MutationCtx) {
  return betterAuth<BetterAuthOptions>({
    ...createAuthOptions(ctx),
    baseURL: SITE_URL,
  }).$context;
}

type Context = Awaited<ReturnType<typeof betterAuthContext>>;
type Write = (context: Context, userId: string) => Promise<unknown>;

/** A point in time as the date that Better Auth's internal adapter takes. */
function dateAt(millis: number) {
  return DateTime.toDateUtc(DateTime.makeUnsafe(millis));
}

/** What Google issued at sign-in, as Better Auth hands it to its internal adapter. */
function issued(name: string) {
  return {
    accessToken: `sealed-access-${name}`,
    accessTokenExpiresAt: dateAt(NOW + HOUR),
    accountId: `google-${name}`,
    idToken: `id-token-${name}`,
    providerId: "google",
    refreshToken: `sealed-refresh-${name}`,
    refreshTokenExpiresAt: dateAt(NOW + DAY),
    scope: SCOPE,
  };
}

/** Every way that Better Auth writes an account, each with the tokens Google issued. */
const creations: Record<string, Write> = {
  "creating an account": (context, userId) =>
    context.internalAdapter.createAccount({ ...issued("create"), userId }),
  "linking an account": (context, userId) =>
    context.internalAdapter.linkAccount({ ...issued("link"), userId }),
  "signing a new learner up": (context) =>
    context.internalAdapter.createOAuthUser(
      { email: "signup@example.com", emailVerified: true, name: "Sign Up" },
      issued("signup")
    ),
};

/** Seeds a learner, then runs one write through Better Auth's internal adapter, which runs the database hooks. */
async function writeThroughBetterAuth(test: Test, write: Write) {
  const { authUserId } = await test.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW })
  );
  await test.mutation(async (ctx) => {
    await write(await betterAuthContext(ctx), authUserId);
    return null;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-better-auth-secret-for-token-tests"
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth/tokens", () => {
  it("asks Google for the account chooser, with no offline access and no repeated consent", async () => {
    const test = createConvexTestWithBetterAuth();
    const response = await test.fetch("/api/auth/sign-in/social", {
      body: encodeJsonText({ callbackURL: "/en", provider: "google" }),
      headers: { "content-type": "application/json", origin: SITE_URL },
      method: "POST",
    });
    const location = response.headers.get("location");
    assert(location, "Expected the Google authorization redirect.");
    const { searchParams } = new URL(location);
    expect(searchParams.get("prompt")).toBe("select_account");
    expect(searchParams.has("access_type")).toBe(false);
  });

  it.each(Rec.toEntries(creations))(
    "stores no token when %s, and keeps the rest of the account",
    async (_case, write) => {
      const test = createConvexTestWithBetterAuth();
      await writeThroughBetterAuth(test, write);
      const [account, ...others] = await storedAccounts(test);
      expect(others).toEqual([]);
      expectNoProviderTokens(account);
      expect(account).toMatchObject({
        createdAt: NOW,
        providerId: "google",
        scope: SCOPE,
        updatedAt: NOW,
      });
    }
  );

  it("stores no token when an account is updated, and keeps the rest of the update", async () => {
    const test = createConvexTestWithBetterAuth();
    await writeThroughBetterAuth(test, (context, userId) =>
      context.internalAdapter.createAccount({
        accountId: "google-update",
        providerId: "google",
        scope: "openid",
        userId,
      })
    );
    const [created] = await storedAccounts(test);
    vi.setSystemTime(NOW + HOUR);
    await test.mutation(async (ctx) => {
      const { internalAdapter } = await betterAuthContext(ctx);
      await internalAdapter.updateAccount(created._id, {
        ...issued("update"),
        scope: SCOPE,
      });
      return null;
    });
    const [updated, ...others] = await storedAccounts(test);
    expect(others).toEqual([]);
    expectNoProviderTokens(updated);
    expect(updated).toMatchObject({
      accountId: "google-update",
      scope: SCOPE,
      updatedAt: NOW + HOUR,
    });
  });

  it("signs a learner in twice and stores no token, in the account or in a cookie", async () => {
    const test = createConvexTestWithBetterAuth();
    const cookies = await test.mutation(async (ctx) => {
      const { authCookies } = await betterAuthContext(ctx);
      return {
        account: authCookies.accountData.name,
        session: authCookies.sessionToken.name,
      };
    });
    const first = await signInWithGoogle(test, "learner", NOW);
    const [created] = await storedAccounts(test);
    expect(created).toMatchObject({
      accountId: "google-learner",
      providerId: "google",
      // The scopes that Google granted, as Better Auth joins them.
      scope: "openid,email,profile",
      updatedAt: NOW,
    });
    expectNoProviderTokens(created);
    // The next sign-in updates the account with the tokens that Google issues again.
    vi.setSystemTime(NOW + HOUR);
    const second = await signInWithGoogle(test, "learner", NOW + HOUR);
    const [updated, ...others] = await storedAccounts(test);
    expect(others).toEqual([]);
    expect(updated.updatedAt).toBe(NOW + HOUR);
    expectNoProviderTokens(updated);
    for (const response of [first, second]) {
      const names = Arr.map(
        response.headers.getSetCookie(),
        (cookie) => cookie.split("=", 1)[0]
      );
      expect(names).toContain(cookies.session);
      expect(names).not.toContain(cookies.account);
    }
  });

  it("refuses a Google ID token on the link route, so no token that comes with it is stored", async () => {
    const test = createConvexTestWithBetterAuth();
    const signedIn = await signInWithGoogle(test, "linking", NOW);
    const before = await storedAccounts(test);
    const keyLookup = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", keyLookup);
    const response = await test.fetch("/api/auth/link-social", {
      body: encodeJsonText({
        idToken: {
          accessToken: "ya29.arrives-plain",
          refreshToken: "1//arrives-plain",
          token: createGoogleIdToken("linking", NOW, GOOGLE_KEY),
        },
        provider: "google",
      }),
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(signedIn),
        origin: SITE_URL,
      },
      method: "POST",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "INVALID_TOKEN" });
    // Checking a token starts with a request for Google's signing keys.
    expect(keyLookup).not.toHaveBeenCalled();
    expect(await storedAccounts(test)).toEqual(before);
  });

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
});
