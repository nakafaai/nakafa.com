import { beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { GUARDIAN_SIGN_IN_PATH } from "@repo/backend/confect/auth/guardian";
import {
  asStaffSchool,
  type Fixture,
  IBU,
  knownCode,
  signInGuardian,
  startLink,
} from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

/** The school host of the test school, as the browser names it through the proxy. */
const SCHOOL_HOST = "nf.localhost:3000";
/** The session cookie that a successful sign-in sets. */
const SESSION_COOKIE_PATTERN = /better-auth\.session_token=[^;]+;/;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** Posts one code sign-in with a JSON body, from a browser on `host`. */
const post = (fixture: Fixture, body: unknown, host = SCHOOL_HOST) =>
  Effect.gen(function* () {
    const encoded = yield* Schema.encodeEffect(JsonTextSchema)(body);
    return yield* Effect.promise(() =>
      fixture.fetch(`/api/auth${GUARDIAN_SIGN_IN_PATH}`, {
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

describe("auth/guardian code sign-in", () => {
  it.effect("signs the guardian in on the school host with a live code", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      yield* startLink(fixture);
      yield* knownCode(fixture, "123456");
      const response = yield* post(fixture, {
        code: " 123456 ",
        email: " IBU@example.com ",
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie") ?? "").toMatch(
        SESSION_COOKIE_PATTERN
      );
      expect(yield* Effect.promise(() => response.json())).toEqual({
        ok: true,
      });
    })
  );

  it.effect(
    "answers a wrong code and a malformed body with one refusal, and any other host with not found",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        yield* knownCode(fixture, "123456");
        const wrong = yield* post(fixture, { code: "654321", email: IBU });
        expect(wrong.status).toBe(401);
        expect(yield* Effect.promise(() => wrong.json())).toMatchObject({
          code: "INVALID_GUARDIAN_CODE",
        });
        const malformed = yield* post(fixture, { email: IBU });
        expect(malformed.status).toBe(401);
        const main = yield* post(
          fixture,
          { code: "123456", email: IBU },
          "localhost:3000"
        );
        expect(main.status).toBe(404);
      })
  );

  it.effect(
    "fails as a server error when the guardian's account is gone, never as a wrong code",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        const account = yield* signInGuardian(fixture);
        yield* fixture.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            yield* Effect.promise(() =>
              ctx.runMutation(components.betterAuth.adapter.deleteOne, {
                input: {
                  model: "user",
                  where: [
                    { field: "_id", operator: "eq", value: account.authUserId },
                  ],
                },
              })
            );
          })
        );
        yield* knownCode(fixture, "654321");
        const response = yield* post(fixture, { code: "654321", email: IBU });
        expect(response.status).toBe(500);
      })
  );
});
