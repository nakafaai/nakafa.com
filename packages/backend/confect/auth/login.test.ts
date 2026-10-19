import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  issue,
  issueFirst,
  nf,
  PASSWORD,
  redeemOn,
} from "@repo/backend/test/identity";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Context,
  Effect,
  Layer,
  Option,
  Predicate,
  Schema,
} from "effect";

/** The school host of the test school, as the browser names it through the proxy. */
const SCHOOL_HOST = "nf.localhost:3000";
/** A device of a second student's browser, which redeems a card of its own. */
const SECOND_DEVICE = "5b9f2d1e-0c4a-4e8b-9f3d-2a7c6e1d8b90";
/** The wrong password that the attempts of a test send. */
const WRONG_PASSWORD = "wrong password here";
/** The address of the second student, which the school invites before its card is printed. */
const SECOND_ADDRESS = Schema.decodeSync(Email)("kedua@example.com");
/** The session cookie that a successful sign-in sets on the school host: its name, and a value. */
const SESSION_COOKIE_PATTERN = /^better-auth\.session_token=[^;]+;/;

type Fixture = Effect.Success<typeof tenancyFixture>;

/** The school of the shared sign-in tests, whose first card is redeemed once for all of them. */
class RedeemedSchool extends Context.Service<
  RedeemedSchool,
  { readonly school: Fixture }
>()("@repo/backend/confect/auth/login.test/RedeemedSchool") {}

/** Sends one username sign-in with a JSON body to the auth router, from a browser on `host`. */
const postSignIn = (fixture: Fixture, body: unknown, host: string) =>
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
  fixture: Fixture,
  body: { readonly username: string; readonly password: string },
  host = SCHOOL_HOST
) => postSignIn(fixture, body, host);

/** The status of one username sign-in of the school host. */
const statusOf = (fixture: Fixture, username: string, password: string) =>
  signInOn(fixture, { password, username }).pipe(
    Effect.map((response) => response.status)
  );

/** The school of the fixture with its first card redeemed, so its login name signs in. */
const redeemedFixture = Effect.gen(function* () {
  const fixture = yield* tenancyFixture;
  const issued = yield* issueFirst(fixture);
  yield* redeemOn(fixture, issued.code);
  return fixture;
});

/**
 * Adds a second student to the school, prints a card for them under `loginName`, and redeems it
 * from `device` with the test password. The second login is then a login of its own.
 */
const addLogin = (fixture: Fixture, loginName: string, device: string) =>
  Effect.gen(function* () {
    const personId = yield* fixture.run(
      invitePerson(fixture.tenants.nf, SECOND_ADDRESS).pipe(
        Effect.map((invited) => invited.personId)
      )
    );
    const issued = yield* fixture
      .as("admin")
      .mutation(issue, { loginName, personId, slug: nf });
    yield* redeemOn(fixture, issued.code, PASSWORD, device, nf, loginName);
  });

describe("auth/login username sign-in", () => {
  /**
   * One redemption serves the tests that read the answer of one sign-in, so each of them pays
   * at most one password hash. A test that spends the school's attempts builds its own school.
   */
  it.layer(
    Layer.effect(
      RedeemedSchool,
      Effect.map(redeemedFixture, (school) => ({ school }))
    )
  )("answers of one redeemed school", (it) => {
    it.effect(
      "signs a school login in on its school host, and sets the shared session cookie",
      () =>
        Effect.gen(function* () {
          const shared = (yield* RedeemedSchool).school;
          const response = yield* signInOn(shared, {
            password: PASSWORD,
            username: "guru.baru",
          });
          expect(response.status).toBe(200);
          const sessionCookie = Arr.findFirst(
            response.headers.getSetCookie(),
            (cookie) => cookie.startsWith("better-auth.session_token=")
          );
          expect(Option.getOrUndefined(sessionCookie)).toMatch(
            SESSION_COOKIE_PATTERN
          );
        })
    );

    it.effect(
      "answers a wrong password with the refusal of a wrong login",
      () =>
        Effect.gen(function* () {
          const shared = (yield* RedeemedSchool).school;
          const response = yield* signInOn(shared, {
            password: WRONG_PASSWORD,
            username: "guru.baru",
          });
          expect(response.status).toBe(401);
          expect(yield* Effect.promise(() => response.json())).toMatchObject({
            code: "INVALID_USERNAME_OR_PASSWORD",
          });
        })
    );

    it.effect(
      "answers an unknown login name with the same refusal as a wrong password",
      () =>
        Effect.gen(function* () {
          const shared = (yield* RedeemedSchool).school;
          const response = yield* signInOn(shared, {
            password: PASSWORD,
            username: "guru.lain",
          });
          expect(response.status).toBe(401);
          expect(yield* Effect.promise(() => response.json())).toMatchObject({
            code: "INVALID_USERNAME_OR_PASSWORD",
          });
        })
    );

    it.effect(
      "answers not found for the sign-in on a host that is not a school host",
      () =>
        Effect.gen(function* () {
          const shared = (yield* RedeemedSchool).school;
          const response = yield* signInOn(
            shared,
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
          const shared = (yield* RedeemedSchool).school;
          const response = yield* postSignIn(shared, "guru.baru", SCHOOL_HOST);
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
          const shared = (yield* RedeemedSchool).school;
          const outcome = yield* shared.run(
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

  it.effect(
    "refuses a login with the right password once its ten attempts are spent",
    () =>
      Effect.gen(function* () {
        const fixture = yield* redeemedFixture;
        const wrong = yield* Effect.forEach(Arr.range(1, 10), () =>
          statusOf(fixture, "guru.baru", WRONG_PASSWORD)
        );
        expect(wrong).toEqual(Arr.replicate(401, 10));
        const response = yield* signInOn(fixture, {
          password: PASSWORD,
          username: "guru.baru",
        });
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "INVALID_USERNAME_OR_PASSWORD",
        });
        expect(response.headers.getSetCookie()).toEqual([]);
      })
  );

  it.effect(
    "clears a login's attempts when its sign-in succeeds, so a success never counts against it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* redeemedFixture;
        yield* Effect.forEach(Arr.range(1, 9), () =>
          statusOf(fixture, "guru.baru", WRONG_PASSWORD)
        );
        expect(yield* statusOf(fixture, "guru.baru", PASSWORD)).toBe(200);
        expect(yield* statusOf(fixture, "guru.baru", WRONG_PASSWORD)).toBe(401);
        expect(yield* statusOf(fixture, "guru.baru", PASSWORD)).toBe(200);
      })
  );

  it.effect(
    "refuses one login's attempts without refusing another login of the school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* redeemedFixture;
        yield* addLogin(fixture, "guru.kedua", SECOND_DEVICE);
        yield* Effect.forEach(Arr.range(1, 10), () =>
          statusOf(fixture, "guru.baru", WRONG_PASSWORD)
        );
        expect(yield* statusOf(fixture, "guru.kedua", PASSWORD)).toBe(200);
      })
  );
});
