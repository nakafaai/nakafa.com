import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SocialSignInFailed, startGoogleSignIn } from "@/lib/auth/social";

const input = {
  callbackURL: "/id/auth/continue",
  errorCallbackURL: "/id/auth/error",
};

describe("social sign-in", () => {
  it.effect("starts Google with both success and failure destinations", () =>
    Effect.gen(function* () {
      const calls: unknown[] = [];

      yield* startGoogleSignIn(input, (request) => {
        calls.push(request);
        return Promise.resolve({
          data: { redirect: true, url: "https://accounts.google.com" },
        });
      });

      expect(calls).toEqual([{ ...input, provider: "google" }]);
    })
  );

  it.effect("maps a provider response error", () =>
    Effect.gen(function* () {
      const failure = yield* startGoogleSignIn(input, () =>
        Promise.resolve({
          error: {
            code: "OAUTH_ERROR",
            message: "Provider failed",
            status: 400,
            statusText: "Bad Request",
          },
        })
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(SocialSignInFailed);
    })
  );

  it.effect("maps a transport rejection", () =>
    Effect.gen(function* () {
      const failure = yield* startGoogleSignIn(input, () =>
        Promise.reject(new Error("offline"))
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(SocialSignInFailed);
    })
  );
});
