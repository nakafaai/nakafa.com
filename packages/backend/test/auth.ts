import { assert, expect } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { ACCOUNT_DELETION_ATTEMPT_HEADER } from "@repo/backend/confect/auth/deletion/constants";
import { noProviderTokens } from "@repo/backend/confect/auth/tokens";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { encodeJsonText } from "@repo/utilities/json";
import type { User } from "better-auth";
import { Array as Arr, DateTime, Effect, pipe, Record as Rec } from "effect";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const BASE64_PADDING_PATTERN = /[=]+$/;
/** The most account rows a test reads at once. */
const STORED_ACCOUNT_LIMIT = 200;

/**
 * The one stand-in for Google's token endpoint in a test file. Each sign-in
 * resets it and sets what it issues, and the test file unstubs the global.
 */
const tokenExchange = vi.fn<typeof fetch>();

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
 * up, which a token from the endpoint never needs.
 */
export function createGoogleIdToken(
  suffix: string,
  now: number,
  header: object = { alg: "none", typ: "JWT" }
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
      }),
      "test-signature",
    ],
    "."
  );
}

/** The Cookie header that carries every cookie a response set. */
function cookieHeader(response: Response) {
  return pipe(
    response.headers.getSetCookie(),
    Arr.map((value) => value.split(";", 1)[0]),
    Arr.join("; ")
  );
}

/**
 * Signs one synthetic learner in through Better Auth's Google callback, with
 * the token endpoint stubbed. The provider issues `access-<suffix>` and
 * `refresh-<suffix>`. The caller sets the fake clock to `now`, and unstubs the
 * global `fetch` afterwards.
 */
export async function signInWithGoogle(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  suffix: string,
  now: number
) {
  tokenExchange.mockReset().mockImplementation((input, init) => {
    expect(String(input)).toBe(GOOGLE_TOKEN_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("code=synthetic-authorization-code");
    return Promise.resolve(
      Response.json({
        access_token: `access-${suffix}`,
        expires_in: 3600,
        id_token: createGoogleIdToken(suffix, now),
        refresh_token: `refresh-${suffix}`,
        scope: "openid email profile",
        token_type: "Bearer",
      })
    );
  });
  vi.stubGlobal("fetch", tokenExchange);
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
  expect(tokenExchange).toHaveBeenCalledOnce();
  return response;
}

/** The `account` rows that the Better Auth component holds, oldest first. */
export async function storedAccounts(
  test: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  const { page } = await test.query((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      paginationOpts: { cursor: null, numItems: STORED_ACCOUNT_LIMIT },
    })
  );
  return page;
}

/** Expects that a stored `account` row holds none of the provider token columns. */
export function expectNoProviderTokens(row: object) {
  for (const field of Rec.keys(noProviderTokens)) {
    expect(row).not.toHaveProperty(field);
  }
}
