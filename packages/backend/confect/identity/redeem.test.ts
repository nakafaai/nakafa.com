import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { setLoginPassword } from "@repo/backend/confect/identity/account";
import { Email, INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import {
  CARD_NOW,
  cardRowOf,
  claimInviteeByInvite,
  DEVICE,
  inviteePerson,
  issueFirst,
  LOGIN_NAME,
  nf,
  PASSWORD,
  redeem,
  redeemOn,
  reissue,
  storedPasswordIs,
  UNKNOWN_CODE,
  userNamed,
} from "@repo/backend/test/identity";
import {
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Exit, Option, Schema } from "effect";

// The password step is the one Better Auth call in a redemption. A test makes it
// fail once to prove that the card and the account roll back together.
vi.mock("@repo/backend/confect/identity/account", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/backend/confect/identity/account")
    >();
  return {
    ...actual,
    setLoginPassword: vi.fn(actual.setLoginPassword),
  };
});

/** A placeholder address: a random UUID key at the reserved `.invalid` domain. */
const PLACEHOLDER_ADDRESS =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@login\.nakafa\.invalid$/;

/** A device the sign-in page keeps, as a UUID, numbered so that each one differs. */
const deviceAt = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

/** Fake timers keep the clock at one moment, so every term and limit is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("identity/cards redeem", () => {
  it.effect(
    "creates the account once, claims the Person by card, and marks the card used",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        const invited = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantInvites").insert({
              channel: {
                email: Schema.decodeSync(Email)("guru@harapan.example.test"),
                kind: "email",
              },
              expiresAt: CARD_NOW + Duration.toMillis(INVITE_TERM),
              personId: fixture.invited,
              state: { status: "pending" },
              tenantId: fixture.tenants.nf,
            })
          )
        );
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
        const person = yield* inviteePerson(fixture);
        expect(person.account).toMatchObject({
          method: "card",
          state: "claimed",
        });
        const user = Option.getOrUndefined(
          yield* userNamed(fixture, "invited")
        );
        expect(user).toMatchObject({ username: "invited" });
        // The placeholder address is named by a random key, never by the name.
        expect(user?.email).toMatch(PLACEHOLDER_ADDRESS);
        expect(user?.email).not.toContain("invited");
        expect(person.account).toMatchObject({ userId: user?._id });
        const invite = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantInvites").get(invited).pipe(Effect.orDie)
          )
        );
        expect(invite.state).toEqual({
          at: CARD_NOW,
          status: "accepted",
          userId: user?._id,
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "card.issued" } },
          {
            actor: { id: fixture.invited, kind: "person" },
            change: { method: "card", type: "person.claimed" },
          },
          {
            actor: { id: fixture.invited, kind: "person" },
            change: { type: "card.redeemed" },
          },
        ]);
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          outcome: "refused",
          reason: "used",
        });
      })
  );

  it.effect("accepts the code without its dash and in lowercase", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      expect(
        yield* redeemOn(fixture, issued.code.replace("-", "").toLowerCase())
      ).toMatchObject({ outcome: "redeemed" });
    })
  );

  it.effect(
    "refuses an unknown code, a code of another school, and a removed Person as invalid",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        expect(yield* redeemOn(fixture, UNKNOWN_CODE)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
        expect(
          yield* redeemOn(
            fixture,
            issued.code,
            PASSWORD,
            DEVICE,
            slugOf("other")
          )
        ).toEqual({ outcome: "refused", reason: "invalid" });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeople")
              .patch(fixture.invited, { status: "removed" })
          )
        );
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
      })
  );

  it.effect(
    "refuses a card typed on the address of no school, and text the alphabet cannot hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        expect(
          yield* redeemOn(
            fixture,
            issued.code,
            PASSWORD,
            DEVICE,
            slugOf("tidak-ada")
          )
        ).toEqual({ outcome: "refused", reason: "invalid" });
        expect(yield* redeemOn(fixture, "1234")).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
        expect(yield* redeemOn(fixture, "UUUUU-UUUUU")).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
      })
  );

  it.effect("refuses every card of a suspended school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenants")
            .patch(fixture.tenants.nf, { status: "suspended" })
        )
      );
      expect(yield* redeemOn(fixture, issued.code)).toEqual({
        outcome: "refused",
        reason: "invalid",
      });
    })
  );

  it.effect(
    "refuses a password that is too short and writes nothing, so the card still works",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        expect(yield* redeemOn(fixture, issued.code, "short")).toEqual({
          outcome: "refused",
          reason: "passwordTooShort",
        });
        expect((yield* inviteePerson(fixture)).account).toEqual({
          state: "unclaimed",
        });
        expect(yield* redeemOn(fixture, issued.code)).toMatchObject({
          outcome: "redeemed",
        });
      })
  );

  it.effect("refuses a password longer than Better Auth accepts", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      expect(yield* redeemOn(fixture, issued.code, "x".repeat(129))).toEqual({
        outcome: "refused",
        reason: "passwordTooLong",
      });
    })
  );

  it.effect("limits the attempts of one device", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      const wrong = yield* Effect.forEach(
        Arr.replicate(UNKNOWN_CODE, 5),
        (code) => redeemOn(fixture, code)
      );
      expect(Arr.map(wrong, (outcome) => outcome.outcome)).toEqual(
        Arr.replicate("refused", 5)
      );
      expect(yield* redeemOn(fixture, issued.code)).toEqual({
        outcome: "refused",
        reason: "rateLimited",
      });
    })
  );

  it.effect(
    "does not let the attempts of other devices block a card that shares their code prefix",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        // A guess that keeps the first five characters of the card, from ten devices.
        const guess = `${issued.code.slice(0, 5)}-${
          issued.code.endsWith("ZZZZZ") ? "00000" : "ZZZZZ"
        }`;
        const outcomes = yield* Effect.forEach(
          Arr.makeBy(10, deviceAt),
          (device) => redeemOn(fixture, guess, PASSWORD, device)
        );
        expect(outcomes).toEqual(
          Arr.replicate({ outcome: "refused", reason: "invalid" }, 10)
        );
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
      })
  );

  it.effect(
    "refuses a card from a signed-in caller before it spends an attempt, and the card stays redeemable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        const signedIn = yield* Effect.forEach(
          Arr.replicate(issued.code, 6),
          (code) =>
            fixture.as("admin").mutation(redeem, {
              code,
              deviceId: DEVICE,
              loginName: LOGIN_NAME,
              password: PASSWORD,
              slug: nf,
            })
        );
        expect(signedIn).toEqual(
          Arr.replicate({ outcome: "refused", reason: "invalid" }, 6)
        );
        expect((yield* inviteePerson(fixture)).account).toEqual({
          state: "unclaimed",
        });
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
      })
  );

  it.effect(
    "refuses a card whose Person was given the Admin role after the card was printed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "admin", {
            kind: "tenant",
          })
        );
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
        expect((yield* inviteePerson(fixture)).account).toEqual({
          state: "unclaimed",
        });
        expect(
          Option.getOrUndefined(yield* cardRowOf(fixture, fixture.invited))
            ?.redeemedAt
        ).toBeUndefined();
      })
  );

  it.effect(
    "reads a removed Person as invalid even when its card was already used",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        expect(yield* redeemOn(fixture, issued.code)).toMatchObject({
          outcome: "redeemed",
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeople")
              .patch(fixture.invited, { status: "removed" })
          )
        );
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
      })
  );

  it.effect(
    "stores the password that the student chose, and a reissued card replaces it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* issueFirst(fixture);
        expect(yield* redeemOn(fixture, first.code, PASSWORD)).toMatchObject({
          outcome: "redeemed",
        });
        expect(yield* storedPasswordIs(fixture, PASSWORD)).toBe(true);
        expect(yield* storedPasswordIs(fixture, "new password here")).toBe(
          false
        );
        const second = yield* fixture
          .as("admin")
          .mutation(reissue, { personId: fixture.invited, slug: nf });
        expect(
          yield* redeemOn(fixture, second.code, "new password here")
        ).toEqual({ loginName: "guru.baru", outcome: "redeemed" });
        expect(yield* storedPasswordIs(fixture, "new password here")).toBe(
          true
        );
        expect(yield* storedPasswordIs(fixture, PASSWORD)).toBe(false);
      })
  );

  it.effect(
    "a reissued card sets a new password on the account that exists, without a second account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* issueFirst(fixture);
        yield* redeemOn(fixture, first.code);
        const claimedBy = (yield* inviteePerson(fixture)).account;
        const second = yield* fixture
          .as("admin")
          .mutation(reissue, { personId: fixture.invited, slug: nf });
        expect(
          yield* redeemOn(fixture, second.code, "new password here")
        ).toEqual({ loginName: "guru.baru", outcome: "redeemed" });
        expect((yield* inviteePerson(fixture)).account).toEqual(claimedBy);
        expect(yield* userNamed(fixture, "invited2")).toEqual(Option.none());
        expect(
          Option.getOrUndefined(yield* cardRowOf(fixture, fixture.invited))
        ).toMatchObject({ redeemedAt: CARD_NOW });
      })
  );

  it.effect(
    "refuses a card whose Person an invite claimed after the card was printed, and changes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* claimInviteeByInvite(fixture);
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
        expect((yield* inviteePerson(fixture)).account).toMatchObject({
          method: "invite",
          userId: fixture.users.stranger.userId,
        });
        expect(
          Option.getOrUndefined(yield* cardRowOf(fixture, fixture.invited))
            ?.redeemedAt
        ).toBeUndefined();
      })
  );

  it.effect(
    "keeps the card unredeemed and leaves no half account when the password step fails",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        vi.mocked(setLoginPassword).mockImplementationOnce(() =>
          Effect.die(new Error("Better Auth is unavailable"))
        );
        const failed = yield* redeemOn(fixture, issued.code).pipe(Effect.exit);
        expect(Exit.isFailure(failed)).toBe(true);
        expect(
          Option.getOrUndefined(yield* cardRowOf(fixture, fixture.invited))
            ?.redeemedAt
        ).toBeUndefined();
        expect((yield* inviteePerson(fixture)).account).toEqual({
          state: "unclaimed",
        });
        expect(yield* userNamed(fixture, "invited")).toEqual(Option.none());
        expect(yield* fixture.run(journal)).toHaveLength(1);
        // The same card still redeems, which proves that no account was left behind.
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
      })
  );

  it.effect(
    "refuses a card under another or a malformed login name as invalid, fresh or used, and a right name still reports a used card",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        const invalid = { outcome: "refused", reason: "invalid" };
        expect(
          yield* redeemOn(
            fixture,
            issued.code,
            PASSWORD,
            DEVICE,
            nf,
            "guru.lain"
          )
        ).toEqual(invalid);
        expect(
          yield* redeemOn(fixture, issued.code, PASSWORD, DEVICE, nf, "x")
        ).toEqual(invalid);
        expect(yield* redeemOn(fixture, issued.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
        expect(
          yield* redeemOn(
            fixture,
            issued.code,
            PASSWORD,
            deviceAt(1),
            nf,
            "guru.lain"
          )
        ).toEqual(invalid);
        expect(
          yield* redeemOn(fixture, issued.code, PASSWORD, deviceAt(2))
        ).toEqual({ outcome: "refused", reason: "used" });
      })
  );
});
