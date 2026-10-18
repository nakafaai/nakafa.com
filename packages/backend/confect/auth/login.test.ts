import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { issueFirst, PASSWORD, redeemOn } from "@repo/backend/test/identity";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Predicate, Schema } from "effect";

/** The school host of the test school, as the browser names it through the proxy. */
const SCHOOL_HOST = "nf.localhost:3000";

/** Sends one username sign-in with a JSON body to the auth router, from a browser on `host`. */
const postSignIn = (
  fixture: Effect.Success<typeof tenancyFixture>,
  body: unknown,
  host: string
) =>
  Effect.gen(function* () {
    const encoded = yield* Schema.encodeEffect(JsonTextSchema)(body);
    return yield* Effect.promise(() =>
      fixture.fetch("/api/auth/sign-in/username", {
        body: encoded,
        headers: {
          "content-type": "application/json",
          origin: `http://${host}`,
          "x-forwarded-host": host,
        },
        method: "POST",
      })
    );
  });

/** Sends one username sign-in to the auth router, from a browser on `host`. */
const signInOn = (
  fixture: Effect.Success<typeof tenancyFixture>,
  body: { readonly username: string; readonly password: string },
  host = SCHOOL_HOST
) => postSignIn(fixture, body, host);

describe("auth/login username sign-in", () => {
  it.effect(
    "signs a school login in on its school host, and sets the shared session cookie",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const response = yield* signInOn(fixture, {
          password: PASSWORD,
          username: "guru.baru",
        });
        expect(response.status).toBe(200);
        expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
      })
  );

  it.effect(
    "answers a wrong password and an unknown login name with the same refusal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const wrongPassword = yield* signInOn(fixture, {
          password: "wrong password here",
          username: "guru.baru",
        });
        const unknownName = yield* signInOn(fixture, {
          password: PASSWORD,
          username: "guru.lain",
        });
        for (const response of [wrongPassword, unknownName]) {
          expect(response.status).toBe(401);
          expect(yield* Effect.promise(() => response.json())).toMatchObject({
            code: "INVALID_USERNAME_OR_PASSWORD",
          });
        }
      })
  );

  it.effect(
    "answers not found for the sign-in on a host that is not a school host",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const response = yield* signInOn(
          fixture,
          { password: PASSWORD, username: "guru.baru" },
          "nakafa.com"
        );
        expect(response.status).toBe(404);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "PASSWORD_SIGN_IN_DISABLED",
        });
      })
  );

  it.effect(
    "refuses a sign-in body that is not an object, as a wrong password is",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const response = yield* postSignIn(fixture, "guru.baru", SCHOOL_HOST);
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "INVALID_USERNAME_OR_PASSWORD",
        });
      })
  );

  it.effect(
    "refuses a server call to the school sign-in, which names no school host",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const outcome = yield* fixture.run(
          Effect.gen(function* () {
            const auth = yield* createAuth(yield* MutationCtx);
            return yield* Effect.promise(() =>
              auth.api
                .signInUsername({
                  body: { password: PASSWORD, username: "guru.baru" },
                })
                .then(
                  () => "signed in",
                  (error: unknown) =>
                    Predicate.hasProperty(error, "body") &&
                    Predicate.hasProperty(error.body, "code")
                      ? error.body.code
                      : "unexpected error"
                )
            );
          })
        );
        expect(outcome).toBe("PASSWORD_SIGN_IN_DISABLED");
      })
  );
});
