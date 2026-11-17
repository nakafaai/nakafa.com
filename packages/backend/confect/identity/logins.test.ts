import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  loginAccountOf,
  readLoginName,
} from "@repo/backend/confect/identity/logins";
import {
  CARD_NOW,
  claimInviteeByInvite,
  inviteePerson,
  issueFirst,
  nf,
  other,
  redeemOn,
} from "@repo/backend/test/identity";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option, Result } from "effect";

describe("identity/logins readLoginName", () => {
  it("reads a name as lowercase, with the spaces around it dropped", () => {
    expect(readLoginName(" Raka.P-2 ")).toEqual(Result.succeed("raka.p-2"));
  });

  it("refuses a name outside the length the school may use", () => {
    expect(readLoginName("ab")).toEqual(Result.fail("length"));
    expect(readLoginName("a".repeat(33))).toEqual(Result.fail("length"));
    expect(readLoginName("abc")).toEqual(Result.succeed("abc"));
    expect(readLoginName("a".repeat(32))).toEqual(
      Result.succeed("a".repeat(32))
    );
  });

  it("refuses a name with a character outside lowercase letters, digits, dots, underscores, and hyphens", () => {
    expect(readLoginName("raka pratama")).toEqual(Result.fail("characters"));
    expect(readLoginName("raka!!")).toEqual(Result.fail("characters"));
  });

  it.each([
    "admin",
    "Admin",
    "nina",
    "settings",
    "sekolah",
    "operator",
    "root",
    "login",
  ])("refuses the name %s that could pass for Nakafa, in any case", (name) => {
    expect(readLoginName(name)).toEqual(Result.fail("reserved"));
  });

  it("accepts a route word, because a school login name is never a URL", () => {
    expect(readLoginName("materi")).toEqual(Result.succeed("materi"));
  });
});

describe("identity/logins loginAccountOf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(CARD_NOW);
  });

  /** The account a typed login name signs in to on a school's host, if any. */
  const accountOf = (
    fixture: Effect.Success<typeof tenancyFixture>,
    loginName: string,
    slug = nf
  ) => fixture.run(loginAccountOf(slug, loginName));

  it.effect(
    "answers the account a card made, read with the typed name's capitals and spaces",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const { account } = yield* inviteePerson(fixture);
        assert(account.state === "claimed", "Expected the card's account.");
        expect(yield* accountOf(fixture, " Guru.Baru ")).toEqual(
          Option.some(account.userId)
        );
      })
  );

  it.effect(
    "answers none for a login without an account, a name the school cannot hold, another school and an unknown one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        expect(yield* accountOf(fixture, "guru.baru")).toEqual(Option.none());
        expect(yield* accountOf(fixture, "x")).toEqual(Option.none());
        expect(yield* accountOf(fixture, "guru.baru", other)).toEqual(
          Option.none()
        );
        expect(yield* accountOf(fixture, "guru.baru", slugOf("nope"))).toEqual(
          Option.none()
        );
      })
  );

  it.effect(
    "answers none for an account that an invite claimed, since only a card sets a password",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        yield* claimInviteeByInvite(fixture);
        expect(yield* accountOf(fixture, "guru.baru")).toEqual(Option.none());
      })
  );

  it.effect.each(["suspended", "removed"] as const)(
    "answers none for a %s Person, whose account can no longer sign in",
    (status) =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").patch(fixture.invited, { status })
          )
        );
        expect(yield* accountOf(fixture, "guru.baru")).toEqual(Option.none());
      })
  );
});
