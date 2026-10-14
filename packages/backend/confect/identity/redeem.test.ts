import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { CARD_TERM } from "@repo/backend/confect/identity/card";
import { hashCardCode } from "@repo/backend/confect/identity/code";
import {
  CARD_NOW,
  cardRowOf,
  DEVICE,
  inviteePerson,
  issueFirst,
  nf,
  PASSWORD,
  redeemOn,
  reissue,
  UNKNOWN_CODE,
  userNamed,
} from "@repo/backend/test/identity";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const TERM = Duration.toMillis(CARD_TERM);

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
        expect(user).toMatchObject({
          email: loginAddress("invited"),
          username: "invited",
        });
        expect(person.account).toMatchObject({ userId: user?._id });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "login.card.issued" } },
          {
            actor: { id: fixture.invited, kind: "person" },
            change: { method: "card", type: "person.claimed" },
          },
          {
            actor: { id: fixture.invited, kind: "person" },
            change: { type: "login.card.redeemed" },
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

  it.effect("refuses a card on the day its term ends", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      vi.setSystemTime(CARD_NOW + TERM);
      expect(yield* redeemOn(fixture, issued.code)).toEqual({
        outcome: "refused",
        reason: "expired",
      });
    })
  );

  it.effect("accepts a card one millisecond before its term ends", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      vi.setSystemTime(CARD_NOW + TERM - 1);
      expect(yield* redeemOn(fixture, issued.code)).toMatchObject({
        outcome: "redeemed",
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

  it.effect("limits the attempts on one code prefix from every device", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* issueFirst(fixture);
      const devices = Arr.makeBy(
        11,
        (index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
      );
      const outcomes = yield* Effect.forEach(devices, (device) =>
        redeemOn(fixture, UNKNOWN_CODE, PASSWORD, device)
      );
      expect(Arr.take(outcomes, 10)).toEqual(
        Arr.replicate({ outcome: "refused", reason: "invalid" }, 10)
      );
      expect(outcomes[10]).toEqual({
        outcome: "refused",
        reason: "rateLimited",
      });
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

  it.effect("refuses a card whose Person has no login name, as invalid", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const codeHash = yield* hashCardCode("ABCDE23456");
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("loginCards").insert({
            codeHash,
            expiresAt: CARD_NOW + TERM,
            issuedAt: CARD_NOW,
            issuedBy: fixture.people.admin.personId,
            personId: fixture.invited,
            tenantId: fixture.tenants.nf,
          })
        )
      );
      expect(yield* redeemOn(fixture, "ABCDE-23456")).toEqual({
        outcome: "refused",
        reason: "invalid",
      });
    })
  );
});
