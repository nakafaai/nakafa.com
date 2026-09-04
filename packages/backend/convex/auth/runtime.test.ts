import { describe, expect, it } from "@effect/vitest";
import {
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import {
  sanitizeProviderErrorRedirectResponse,
  verifyAccountDeletionPreparation,
} from "@repo/backend/convex/auth/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

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
});
