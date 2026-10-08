import { RegisteredConvexFunction } from "@confect/server";
import { convex } from "@convex-dev/better-auth/plugins";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { GoogleAuthConfigError } from "@repo/backend/confect/auth/config";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/confect/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import {
  createAuth,
  createAuthOptions,
  sanitizeProviderErrorRedirectResponse,
  verifyAccountDeletionPreparation,
} from "@repo/backend/confect/auth/runtime";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { User } from "better-auth";
import { Array as Arr, Effect, pipe, Schema } from "effect";

vi.mock("@convex-dev/better-auth/plugins", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@convex-dev/better-auth/plugins")>();
  return {
    ...actual,
    convex: vi.fn(actual.convex),
  };
});

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const SITE_URL = new URL("http://localhost:3000");
const JsonSchema = Schema.fromJsonString(Schema.Unknown);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const authUser = (id: string): User => ({
  createdAt: new Date(NOW),
  email: "deletion-runtime@example.com",
  emailVerified: true,
  id,
  name: "Deletion Runtime",
  updatedAt: new Date(NOW),
});
const withPostHogErasureConfig = Effect.sync(() => {
  vi.stubEnv("POSTHOG_ERASURE_API_KEY", "phx_test_deletion_runtime");
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("POSTHOG_PROJECT_ID", "1");
});
describe("auth/runtime", () => {
  it("preserves every response cookie while scrubbing provider diagnostics", () => {
    const headers = new Headers({
      location:
        "http://localhost:3000/id/auth/error?intent=%2Fid%2Fsearch&error=access_denied&error_description=private",
    });
    headers.append(
      "set-cookie",
      "better-auth.state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    );
    headers.append(
      "set-cookie",
      "better-auth.transient=retained; Path=/; HttpOnly; SameSite=Lax"
    );
    const original = new Response(null, {
      headers,
      status: 302,
    });
    const sanitized = sanitizeProviderErrorRedirectResponse(original, SITE_URL);
    expect(sanitized?.headers.getSetCookie()).toEqual(
      original.headers.getSetCookie()
    );
    expect(sanitized?.headers.get("location")).toBe(
      "http://localhost:3000/id/auth/error?intent=%2Fid%2Fsearch"
    );
  });
  it.each([
    ["an invalid location", "http://[invalid"],
    ["a different origin", "https://example.com/en/auth/error?error=private"],
    ["a non-error app route", "http://localhost:3000/en/search?error=private"],
  ])("does not rewrite %s", (_label, location) => {
    const response = new Response(null, {
      headers: {
        location,
      },
      status: 302,
    });
    expect(
      sanitizeProviderErrorRedirectResponse(response, SITE_URL)
    ).toBeUndefined();
    expect(response.headers.get("location")).toBe(location);
  });
  it("removes every provider value when no continuation intent exists", () => {
    const response = Response.redirect(
      "http://localhost:3000/de/auth/error?error=access_denied#error-fragment",
      302
    );
    const sanitized = sanitizeProviderErrorRedirectResponse(response, SITE_URL);
    expect(sanitized?.headers.get("location")).toBe(
      "http://localhost:3000/de/auth/error"
    );
  });
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
      const body = yield* Schema.encodeEffect(JsonSchema)({
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
        const signInBody = yield* Schema.encodeEffect(JsonSchema)({
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
  it.each([
    ["POST", "/api/auth/change-password"],
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
  it.effect("accepts one ready preparation step", () =>
    Effect.gen(function* () {
      const prepare = vi.fn(() =>
        Effect.succeed(accountDeletionPreparationOutcome.ready)
      );
      expect(
        yield* verifyAccountDeletionPreparation(Effect.suspend(prepare))
      ).toBeUndefined();
      expect(prepare).toHaveBeenCalledOnce();
    })
  );
  it.effect.each([
    {
      code: ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
      outcome: accountDeletionPreparationOutcome.continue,
      status: "BAD_REQUEST",
    },
    {
      code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
      outcome: accountDeletionPreparationOutcome.schoolSuccessorRequired,
      status: "BAD_REQUEST",
    },
    {
      code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
      outcome: accountDeletionPreparationOutcome.temporarilyUnavailable,
      status: "INTERNAL_SERVER_ERROR",
    },
  ])("maps $outcome without draining another step", (testCase) =>
    Effect.gen(function* () {
      const prepare = vi.fn(() => Effect.succeed(testCase.outcome));
      const failure = yield* verifyAccountDeletionPreparation(
        Effect.suspend(prepare)
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({
        body: {
          code: testCase.code,
        },
        name: "APIError",
        status: testCase.status,
      });
      expect(prepare).toHaveBeenCalledOnce();
    })
  );
  it.effect.each(["failure", "defect"] as const)(
    "sanitizes adapter %s without retrying inside the auth request",
    (kind) =>
      Effect.gen(function* () {
        const prepare = vi.fn(() =>
          kind === "failure"
            ? Effect.fail(
                toUserCleanupError(new Error("preparation unavailable"))
              )
            : Effect.die(new Error("private adapter detail"))
        );
        const failure = yield* verifyAccountDeletionPreparation(
          Effect.suspend(prepare)
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          body: {
            code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          },
          name: "APIError",
          status: "INTERNAL_SERVER_ERROR",
        });
        expect(prepare).toHaveBeenCalledOnce();
        const serializedFailure =
          yield* Schema.encodeEffect(JsonSchema)(failure);
        expect(serializedFailure).not.toContain("private adapter detail");
      })
  );
  it.effect("claims deletion through the Better Auth action hook", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      yield* Effect.sync(() => vi.setSystemTime(NOW));
      const test = createConvexTestWithBetterAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "deletion-runtime-hook",
          })
        )
      );
      const authenticated = test.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });
      const prepared = yield* Effect.promise(() =>
        authenticated.mutation(
          api.auth.deletion.prepareCurrentAccountDeletion,
          {
            attemptId: ATTEMPT_ID,
          }
        )
      );
      yield* Effect.promise(() =>
        test.action((ctx) =>
          createAuthOptions(ctx).user.deleteUser.beforeDelete(
            authUser(identity.authUserId),
            new Request("http://localhost:3000/api/auth/delete-user", {
              headers: {
                [ACCOUNT_DELETION_ATTEMPT_HEADER]: ATTEMPT_ID,
              },
              method: "POST",
            })
          )
        )
      );
      const preparation = yield* Effect.promise(() =>
        test.query((ctx) =>
          ctx.db.query("accountDeletionPreparations").unique()
        )
      );
      expect(prepared).toBe(accountDeletionPreparationOutcome.ready);
      expect(preparation?.deletionStartedAt).toBe(NOW);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          vi.unstubAllEnvs();
          vi.useRealTimers();
        })
      )
    )
  );
  it.effect("rejects deletion outside an action context", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      const test = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            createAuthOptions(ctx).user.deleteUser.beforeDelete(
              authUser("mutation-context-user"),
              new Request("http://localhost:3000/api/auth/delete-user", {
                headers: {
                  [ACCOUNT_DELETION_ATTEMPT_HEADER]: ATTEMPT_ID,
                },
                method: "POST",
              })
            )
          )
        ).rejects.toMatchObject({
          body: {
            code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          },
          status: "INTERNAL_SERVER_ERROR",
        })
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
  it.effect("requires the browser deletion attempt header", () =>
    Effect.gen(function* () {
      yield* withPostHogErasureConfig;
      const test = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        expect(
          test.action((ctx) =>
            createAuthOptions(ctx).user.deleteUser.beforeDelete(
              authUser("missing-attempt-user"),
              undefined
            )
          )
        ).rejects.toMatchObject({
          body: {
            code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          },
          status: "INTERNAL_SERVER_ERROR",
        })
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
});
it("publishes only public key material from configured Better Auth signing keys", async () => {
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
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  vi.stubEnv("CONVEX_SITE_URL", "https://technical-auth.convex.site");
  vi.stubEnv(
    "JWKS",
    Schema.encodeSync(JsonSchema)([
      {
        id: "technical-signing-key",
        alg: "RS256",
        publicKey: Schema.encodeSync(JsonSchema)(publicKey),
        privateKey: "private-material-must-not-be-published",
        createdAt: NOW,
      },
    ])
  );
  vi.resetModules();
  const { default: config } = await import("@repo/backend/confect/auth");
  const provider = config.providers[0];
  expect(provider).toMatchObject({
    applicationID: "convex",
    issuer: "https://technical-auth.convex.site",
    algorithm: "RS256",
  });
  const keys = Schema.decodeSync(JsonSchema)(
    atob(provider.jwks.slice(provider.jwks.indexOf(",") + 1))
  );
  expect(keys).toEqual({
    keys: [
      {
        ...publicKey,
        alg: "RS256",
        kid: "technical-signing-key",
      },
    ],
  });
  expect(Schema.encodeSync(JsonSchema)(keys)).not.toContain("private-material");
  const t = createConvexTestWithBetterAuth();
  const ids = await t.action(async (ctx) =>
    Arr.map(createAuthOptions(ctx).plugins, (plugin) => plugin.id)
  );
  expect(ids).toContain("convex");
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
