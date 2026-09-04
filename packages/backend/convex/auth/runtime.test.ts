import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import {
  createAuthOptions,
  sanitizeProviderErrorRedirectResponse,
  verifyAccountDeletionPreparation,
} from "@repo/backend/convex/auth/runtime";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { User } from "better-auth";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

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
    const original = new Response(null, { headers, status: 302 });

    const sanitized = sanitizeProviderErrorRedirectResponse(original);

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
      headers: { location },
      status: 302,
    });

    expect(sanitizeProviderErrorRedirectResponse(response)).toBeUndefined();
    expect(response.headers.get("location")).toBe(location);
  });

  it("removes every provider value when no continuation intent exists", () => {
    const response = Response.redirect(
      "http://localhost:3000/de/auth/error?error=access_denied#error-fragment",
      302
    );

    const sanitized = sanitizeProviderErrorRedirectResponse(response);

    expect(sanitized?.headers.get("location")).toBe(
      "http://localhost:3000/de/auth/error"
    );
  });

  it.effect(
    "removes provider diagnostics before redirecting to the app error landing",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
        vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
        const test = createConvexTestWithBetterAuth();
        const intent = "/en/search?q=geometry#results";
        const errorCallbackURL = `/en/auth/error?${new URLSearchParams({
          intent,
        })}`;
        const signInResponse = yield* Effect.promise(() =>
          test.fetch("/api/auth/sign-in/social", {
            body: JSON.stringify({
              callbackURL: "/en/auth/continue",
              errorCallbackURL,
              provider: "google",
            }),
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:3000",
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
        const cookie = signInResponse.headers
          .getSetCookie()
          .map((value) => value.split(";", 1)[0])
          .join("; ");

        const providerResponse = yield* Effect.promise(() =>
          test.fetch(
            `/api/auth/callback/google?${new URLSearchParams({
              error: "access_denied",
              error_description: "private provider diagnostic",
              state,
            })}`,
            { headers: { cookie } }
          )
        );
        const providerLocation = yield* Effect.fromNullishOr(
          providerResponse.headers.get("location")
        ).pipe(Effect.orDie);
        const providerUrl = new URL(providerLocation);

        expect(providerResponse.status).toBe(302);
        expect(providerUrl.origin).toBe("http://localhost:3000");
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
        headers: { origin: "http://localhost:3000" },
        method,
      });

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    }
  );

  it.effect("accepts one ready preparation step", () =>
    Effect.gen(function* () {
      const prepare = vi.fn(() =>
        Promise.resolve(accountDeletionPreparationOutcome.ready)
      );

      expect(yield* verifyAccountDeletionPreparation(prepare)).toBeUndefined();
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
      const prepare = vi.fn(() => Promise.resolve(testCase.outcome));
      const failure = yield* verifyAccountDeletionPreparation(prepare).pipe(
        Effect.flip
      );

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

  it.effect(
    "maps adapter failures without retrying inside the auth request",
    () =>
      Effect.gen(function* () {
        const prepare = vi.fn(() =>
          Promise.reject(new Error("preparation unavailable"))
        );
        const failure = yield* verifyAccountDeletionPreparation(prepare).pipe(
          Effect.flip
        );

        expect(failure).toMatchObject({
          body: {
            code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          },
          name: "APIError",
          status: "INTERNAL_SERVER_ERROR",
        });
        expect(prepare).toHaveBeenCalledOnce();
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
          { attemptId: ATTEMPT_ID }
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
          body: { code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE },
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
          body: { code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE },
          status: "INTERNAL_SERVER_ERROR",
        })
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );
});
