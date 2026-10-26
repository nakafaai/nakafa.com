import { assert, expect } from "@effect/vitest";
import type { Doc } from "@repo/backend/components/betterAuth/_generated/dataModel";
import { components } from "@repo/backend/confect/_generated/components";
import { ACCOUNT_DELETION_ATTEMPT_HEADER } from "@repo/backend/confect/auth/deletion/constants";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { encodeJsonText } from "@repo/utilities/json";
import type { User } from "better-auth";
import { Array as Arr, DateTime, Effect, pipe } from "effect";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const BASE64_PADDING_PATTERN = /[=]+$/;
/** How many account rows `storedAccounts` reads in one query. */
const STORED_ACCOUNT_PAGE_SIZE = 100;

/**
 * The one stand-in for Google in a test file. Each sign-in stubs the global
 * `fetch` with it, resets it, and sets what Google's token endpoint issues. A
 * test that expects no request to Google resets it and checks that it was never
 * called. The test file unstubs the global.
 */
export const googleFetch = vi.fn<typeof fetch>();

/** The Better Auth user that an account deletion hook receives. */
export function betterAuthUser(id: string, now: number): User {
  return {
    createdAt: DateTime.toDateUtc(DateTime.makeUnsafe(now)),
    email: "deletion-runtime@example.com",
    emailVerified: true,
    id,
    name: "Deletion Runtime",
    updatedAt: DateTime.toDateUtc(DateTime.makeUnsafe(now)),
  };
}

/** The request the browser sends to delete a user, carrying one deletion attempt. */
export function accountDeletionRequest(attemptId: string) {
  return new Request("http://localhost:3000/api/auth/delete-user", {
    headers: {
      [ACCOUNT_DELETION_ATTEMPT_HEADER]: attemptId,
    },
    method: "POST",
  });
}

/** Generates an RSA signing key and returns its public half as a JWK. */
export async function generateSigningPublicKey() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"]
  );
  return crypto.subtle.exportKey("jwk", pair.publicKey);
}

/** Stubs the PostHog erasure configuration that account deletion requires. */
export const withPostHogErasureConfig = Effect.sync(() => {
  vi.stubEnv("POSTHOG_ERASURE_API_KEY", "phx_test_deletion_runtime");
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("POSTHOG_PROJECT_ID", "1");
});

/** Encodes one part of an unsigned test token the way a JWT does. */
function encodeGoogleTokenPart(value: object) {
  return btoa(encodeJsonText(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_PADDING_PATTERN, "");
}

/** The header of an ID token that names a Google signing key. */
export const GOOGLE_KEY = {
  alg: "RS256",
  kid: "stored-id-token-key",
  typ: "JWT",
};

/**
 * The unsigned ID token that the stubbed Google token endpoint issues. A
 * `header` that names an algorithm and a key id makes Better Auth look the key
 * up, which a token from the endpoint never needs. `claims` adds to or replaces
 * the profile, such as the hosted domain (`hd`) of a Google Workspace account.
 */
export function createGoogleIdToken(
  suffix: string,
  now: number,
  header: object = { alg: "none", typ: "JWT" },
  claims: object = {}
) {
  const issuedAt = Math.floor(now / 1000);
  return Arr.join(
    [
      encodeGoogleTokenPart(header),
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
        ...claims,
      }),
      "test-signature",
    ],
    "."
  );
}

/** The Cookie header that carries every cookie a response set. */
export function cookieHeader(response: Response) {
  return pipe(
    response.headers.getSetCookie(),
    Arr.map((value) => value.split(";", 1)[0]),
    Arr.join("; ")
  );
}

/**
 * Signs one synthetic learner in through Better Auth's Google callback, with
 * the token endpoint stubbed. The provider issues `access-<suffix>` and
 * `refresh-<suffix>`, and an ID token with `claims` over its profile. The
 * caller sets the fake clock to `now`, and unstubs the global `fetch`
 * afterwards.
 */
export async function signInWithGoogle(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  suffix: string,
  now: number,
  claims: object = {}
) {
  googleFetch.mockReset().mockImplementation((input, init) => {
    expect(String(input)).toBe(GOOGLE_TOKEN_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("code=synthetic-authorization-code");
    return Promise.resolve(
      Response.json({
        access_token: `access-${suffix}`,
        expires_in: 3600,
        id_token: createGoogleIdToken(suffix, now, undefined, claims),
        refresh_token: `refresh-${suffix}`,
        scope: "openid email profile",
        token_type: "Bearer",
      })
    );
  });
  vi.stubGlobal("fetch", googleFetch);
  const signInResponse = await test.fetch("/api/auth/sign-in/social", {
    body: encodeJsonText({
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
  assert(authorizationLocation, "Expected Google authorization redirect.");
  const state = new URL(authorizationLocation).searchParams.get("state");
  assert(state, "Expected Google authorization state.");
  const response = await test.fetch(
    `/api/auth/callback/google?${new URLSearchParams({
      code: "synthetic-authorization-code",
      state,
    })}`,
    {
      headers: {
        cookie: cookieHeader(signInResponse),
      },
    }
  );
  expect(googleFetch).toHaveBeenCalledOnce();
  return response;
}

/** Every `account` row that the Better Auth component holds, oldest first. */
export async function storedAccounts(
  test: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  let accounts: readonly Doc<"account">[] = [];
  let cursor: string | null = null;
  do {
    const result = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor, numItems: STORED_ACCOUNT_PAGE_SIZE },
      })
    );
    accounts = Arr.appendAll(accounts, result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);
  return accounts;
}

/**
 * The `account` columns that hold what Google issues at sign-in. The list is
 * written out here and not read from the account hooks, so that a column
 * dropped from the hooks fails the tests that use it.
 */
const PROVIDER_TOKEN_COLUMNS: ReadonlyArray<keyof Doc<"account">> = [
  "accessToken",
  "accessTokenExpiresAt",
  "idToken",
  "refreshToken",
  "refreshTokenExpiresAt",
];

/** Expects that a stored `account` row holds none of the provider token columns. */
export function expectNoProviderTokens(row: object) {
  for (const column of PROVIDER_TOKEN_COLUMNS) {
    expect(row).not.toHaveProperty(column);
  }
}
