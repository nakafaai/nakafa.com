import { beforeEach, describe, expect, it } from "@effect/vitest";
import authTest from "@convex-dev/auth/test";
import refs from "@repo/backend/confect/_generated/refs";
import {
  CARD_NOW,
  issueFirst,
  LOGIN_NAME,
  nf,
  other,
  PASSWORD,
  redeemOn,
} from "@repo/backend/test/identity";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

/** The one answer a school sign-in gives for every refusal. */
const REFUSED = {
  status: "error",
  userError: { error: "INVALID_CREDENTIALS" },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("auth/school", () => {
  it.effect(
    "signs a redeemed card's login in on its school and starts a session of its account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const card = yield* issueFirst(fixture);
        yield* redeemOn(fixture, card.code, PASSWORD);
        const answer = yield* fixture.anonymous.mutation(
          refs.public.auth.school.signIn,
          { loginName: LOGIN_NAME, password: PASSWORD, slug: nf }
        );
        expect(answer.status).toBe("complete");
        if (answer.status !== "complete") {
          return;
        }
        const me = yield* fixture
          .signedIn(authTest.sessionIdentity(answer.tokens).subject)
          .query(refs.public.auth.queries.getCurrentUser, {});
        expect(me?.appUser._id).toBe(answer.tokens.userId);
      })
  );

  it.effect(
    "answers one refusal for a wrong password, an unknown login, another school and a malformed name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const card = yield* issueFirst(fixture);
        yield* redeemOn(fixture, card.code, PASSWORD);
        const signIn = (slug: typeof nf, loginName: string, password: string) =>
          fixture.anonymous.mutation(refs.public.auth.school.signIn, {
            loginName,
            password,
            slug,
          });
        expect(yield* signIn(nf, LOGIN_NAME, "wrong password here")).toEqual(
          REFUSED
        );
        expect(yield* signIn(nf, "guru.lain", PASSWORD)).toEqual(REFUSED);
        expect(yield* signIn(other, LOGIN_NAME, PASSWORD)).toEqual(REFUSED);
        expect(yield* signIn(nf, "Not A Login!", PASSWORD)).toEqual(REFUSED);
      })
  );
});
