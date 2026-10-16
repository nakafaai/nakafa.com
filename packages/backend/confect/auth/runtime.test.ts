import { RegisteredConvexFunction } from "@confect/server";
import { convex } from "@convex-dev/better-auth/plugins";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { GoogleAuthConfigError } from "@repo/backend/confect/auth/config";
import {
  createAuth,
  createAuthOptions,
} from "@repo/backend/confect/auth/runtime";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { createGoogleIdToken, GOOGLE_KEY } from "@repo/backend/test/auth";
import { JsonTextSchema } from "@repo/utilities/json";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { Array as Arr, Effect, Predicate, pipe, Schema } from "effect";

vi.mock("@convex-dev/better-auth/plugins", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@convex-dev/better-auth/plugins")>();
  return {
    ...actual,
    convex: vi.fn(actual.convex),
  };
});

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("auth/runtime", () => {
  it.effect(
    "registers auth schema and adapters without request credentials",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", undefined);
        vi.stubEnv("AUTH_GOOGLE_ID", undefined);
        vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
        const test = createConvexTestWithBetterAuth();
        const user = yield* Effect.promise(() =>
          test.run((ctx) =>
            seedAuthenticatedUser(ctx, {
              now: NOW,
            })
          )
        );
        expect(user.authUserId).toBeTruthy();
        expect(user.sessionId).toBeTruthy();
      })
  );
  it.effect.each(["SITE_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const)(
    "fails auth creation with a typed error when %s is absent",
    (environment) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        vi.stubEnv(environment, undefined);
        const test = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          test.run((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const failure = yield* createAuth(ctx).pipe(
                  Effect.flip,
                  Effect.orDie
                );
                expect(failure).toBeInstanceOf(
                  environment === "SITE_URL"
                    ? SiteConfigError
                    : GoogleAuthConfigError
                );
                return null;
              }).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
      })
  );
  it.effect("fails auth HTTP requests without blocking unrelated routes", () =>
    Effect.gen(function* () {
      vi.stubEnv("SITE_URL", "not-a-url");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const test = createConvexTestWithBetterAuth();
      const discovery = yield* Effect.promise(() =>
        test.fetch("/.well-known/openid-configuration")
      );
      const body = yield* Schema.encodeEffect(JsonTextSchema)({
        callbackURL: "/en/home",
        provider: "google",
      });
      const authFailure = yield* Effect.tryPromise(() =>
        test.fetch("/api/auth/sign-in/social", {
          body,
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          method: "POST",
        })
      ).pipe(Effect.flip);
      expect(discovery.status).toBe(302);
      expect(discovery.headers.get("location")).toBe(
        "/api/auth/convex/.well-known/openid-configuration"
      );
      // The component HTTP boundary lets Convex turn an invalid setup into 500.
      expect(authFailure.cause).toBeInstanceOf(SiteConfigError);
    })
  );
  it.effect.each(["http://localhost:3000", "https://local.nakafa.com"])(
    "removes provider diagnostics before redirecting to the configured site %s",
    (siteOrigin) =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", siteOrigin);
        vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
        vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
        const test = createConvexTestWithBetterAuth();
        const intent = "/en/search?q=geometry#results";
        const errorCallbackURL = `/en/auth/error?${new URLSearchParams({
          intent,
        })}`;
        const signInBody = yield* Schema.encodeEffect(JsonTextSchema)({
          callbackURL: "/en/onboarding",
          errorCallbackURL,
          provider: "google",
        });
        const signInResponse = yield* Effect.promise(() =>
          test.fetch("/api/auth/sign-in/social", {
            body: signInBody,
            headers: {
              "content-type": "application/json",
              origin: siteOrigin,
            },
            method: "POST",
          })
        );
        const authorizationLocation = yield* Effect.fromNullishOr(
          signInResponse.headers.get("location")
        ).pipe(Effect.orDie);
        const state = yield* Effect.fromNullishOr(
          new URL(authorizationLocation).searchParams.get("state")
        ).pipe(Effect.orDie);
        const cookie = pipe(
          signInResponse.headers.getSetCookie(),
          Arr.map((value) => value.split(";", 1)[0]),
          Arr.join("; ")
        );
        const providerResponse = yield* Effect.promise(() =>
          test.fetch(
            `/api/auth/callback/google?${new URLSearchParams({
              error: "access_denied",
              error_description: "private provider diagnostic",
              state,
            })}`,
            {
              headers: {
                cookie,
              },
            }
          )
        );
        const providerLocation = yield* Effect.fromNullishOr(
          providerResponse.headers.get("location")
        ).pipe(Effect.orDie);
        const providerUrl = new URL(providerLocation);
        expect(providerResponse.status).toBe(302);
        expect(providerUrl.origin).toBe(siteOrigin);
        expect(providerUrl.pathname).toBe("/en/auth/error");
        expect([...providerUrl.searchParams]).toEqual([["intent", intent]]);
        expect(providerLocation).not.toContain("access_denied");
        expect(providerLocation).not.toContain("error_description");
        expect(providerLocation).not.toContain("private+provider+diagnostic");
        expect(providerResponse.headers.getSetCookie()).not.toHaveLength(0);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
  it.effect(
    "sets every sign-in cookie on the site's domain, so each school host under it shares the session",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", "https://local.nakafa.com");
        vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
        vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
        const test = createConvexTestWithBetterAuth();
        const signInBody = yield* Schema.encodeEffect(JsonTextSchema)({
          callbackURL: "/en/onboarding",
          errorCallbackURL: "/en/auth/error",
          provider: "google",
        });
        const signInResponse = yield* Effect.promise(() =>
          test.fetch("/api/auth/sign-in/social", {
            body: signInBody,
            headers: {
              "content-type": "application/json",
              origin: "https://local.nakafa.com",
            },
            method: "POST",
          })
        );
        const cookies = signInResponse.headers.getSetCookie();
        expect(cookies).not.toHaveLength(0);
        for (const cookie of cookies) {
          expect(cookie).toContain("Domain=local.nakafa.com");
        }
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
  it.effect(
    "never looks a Google ID token up, so a copied one cannot sign anyone in",
    () =>
      Effect.gen(function* () {
        const fetcher = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetcher);
        const test = createConvexTestWithBetterAuth();
        const body = yield* Schema.encodeEffect(JsonTextSchema)({
          idToken: { token: createGoogleIdToken("copied", NOW, GOOGLE_KEY) },
          provider: "google",
        });
        const response = yield* Effect.promise(() =>
          test.fetch("/api/auth/sign-in/social", {
            body,
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "INVALID_TOKEN",
        });
        expect(response.headers.getSetCookie()).toHaveLength(0);
        // Checking a token starts with a request for Google's signing keys.
        expect(fetcher).not.toHaveBeenCalled();
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals())))
  );
  it.each([
    ["POST", "/api/auth/change-password"],
    ["POST", "/api/auth/is-username-available"],
    ["POST", "/api/auth/request-password-reset"],
    ["POST", "/api/auth/reset-password"],
    ["GET", "/api/auth/reset-password/legacy-token?callbackURL=%2Fen"],
    ["POST", "/api/auth/set-password"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/sign-in/username"],
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/verify-password"],
  ] as const)(
    "returns 404 for retired credential route %s %s",
    async (method, path) => {
      const test = createConvexTestWithBetterAuth();
      const response = await test.fetch(path, {
        headers: {
          origin: "http://localhost:3000",
        },
        method,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    }
  );
  it("refuses a password sign-up that server code calls directly", async () => {
    const test = createConvexTestWithBetterAuth();
    const outcome = await test.run((ctx) =>
      betterAuth<BetterAuthOptions>({
        ...createAuthOptions(ctx),
        baseURL: "http://localhost:3000",
      })
        .api.signUpEmail({
          body: {
            email: "siswa@harapan.example.test",
            name: "Siswa",
            password: "correct horse battery",
          },
        })
        .then(
          () => "signed up",
          (error: unknown) =>
            Predicate.hasProperty(error, "body") &&
            Predicate.hasProperty(error.body, "code")
              ? error.body.code
              : "unexpected error"
        )
    );
    expect(outcome).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });
});
it("passes a configured JWKS value to the convex plugin", async () => {
  const jwks = '[{"id":"runtime-signing-key"}]';
  vi.stubEnv("JWKS", jwks);
  const t = createConvexTestWithBetterAuth();
  await t.action((ctx) =>
    Effect.runPromise(
      Effect.sync(() => createAuthOptions(ctx)).pipe(Effect.asVoid)
    )
  );
  expect(convex).toHaveBeenLastCalledWith(expect.objectContaining({ jwks }));
});
it.each([
  ["unset", undefined],
  ["empty", ""],
])(
  "leaves the convex plugin JWKS option out when JWKS is %s",
  async (_label, jwks) => {
    vi.stubEnv("JWKS", jwks);
    const t = createConvexTestWithBetterAuth();
    await t.action((ctx) =>
      Effect.runPromise(
        Effect.sync(() => createAuthOptions(ctx)).pipe(Effect.asVoid)
      )
    );
    expect(vi.mocked(convex).mock.lastCall?.[0]).not.toHaveProperty("jwks");
  }
);
