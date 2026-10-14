import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CARD_TERM } from "@repo/backend/confect/identity/card";
import { hashCardCode } from "@repo/backend/confect/identity/code";
import {
  CARD_NOW,
  CODE_PATTERN,
  cardRowOf,
  issue,
  issueFirst,
  nf,
  other,
  redeemOn,
  reissue,
} from "@repo/backend/test/identity";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const TERM = Duration.toMillis(CARD_TERM);

/** Fake timers keep the clock at one moment, so every term and limit is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("identity/cards issue", () => {
  it.effect(
    "issues a first card with a login name, shows the code once, and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        expect(issued).toMatchObject({
          code: expect.stringMatching(CODE_PATTERN),
          expiresAt: CARD_NOW + TERM,
          loginName: "guru.baru",
        });
        const stored = yield* cardRowOf(fixture, fixture.invited);
        expect(Option.getOrUndefined(stored)).toMatchObject({
          codeHash: yield* hashCardCode(issued.code.replace("-", "")),
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "login.card.issued" },
            subject: { id: fixture.invited, kind: "person" },
          },
        ]);
      })
  );

  it.effect("refuses a login name that the school cannot use", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const reserved = yield* issueFirst(fixture, "admin").pipe(Effect.flip);
      const short = yield* issueFirst(fixture, "ab").pipe(Effect.flip);
      const typed = yield* issueFirst(fixture, "raka pratama").pipe(
        Effect.flip
      );
      expect([reserved, short, typed]).toMatchObject([
        { _tag: "LoginNameRefused", reason: "reserved" },
        { _tag: "LoginNameRefused", reason: "length" },
        { _tag: "LoginNameRefused", reason: "characters" },
      ]);
    })
  );

  it.effect(
    "refuses a login name another Person of the school holds, in any case, and allows it in another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture, "siti.n");
        const second = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").insert({
              account: { state: "unclaimed" },
              kind: "member",
              name: "Second",
              status: "active",
              tenantId: fixture.tenants.nf,
            })
          )
        );
        const taken = yield* fixture
          .as("admin")
          .mutation(issue, { loginName: "SITI.N", personId: second, slug: nf })
          .pipe(Effect.flip);
        expect(taken).toMatchObject({ _tag: "LoginNameTaken" });
        const elsewhere = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").insert({
              account: { state: "unclaimed" },
              kind: "member",
              name: "Elsewhere",
              status: "active",
              tenantId: fixture.tenants.other,
            })
          )
        );
        expect(
          yield* fixture.as("otherOwner").mutation(issue, {
            loginName: "siti.n",
            personId: elsewhere,
            slug: other,
          })
        ).toMatchObject({ loginName: "siti.n" });
      })
  );

  it.effect(
    "refuses a second first card for a Person who already has a login name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        const again = yield* issueFirst(fixture, "guru.lain").pipe(Effect.flip);
        expect(again).toMatchObject({ _tag: "LoginExists" });
      })
  );

  it.effect("refuses a caller without the card right, and a stranger", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = yield* fixture
        .as("teacher")
        .mutation(issue, {
          loginName: "guru.baru",
          personId: fixture.invited,
          slug: nf,
        })
        .pipe(Effect.flip);
      const stranger = yield* fixture
        .as("otherOwner")
        .mutation(issue, {
          loginName: "guru.baru",
          personId: fixture.invited,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect([teacher, stranger]).toMatchObject([
        { _tag: "AccessDenied", reason: "role" },
        { _tag: "NotMember" },
      ]);
    })
  );

  it.effect(
    "lets an Admin issue a card for an Owner only when the Admin holds owner.manage",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const denied = yield* fixture
          .as("admin")
          .mutation(issue, {
            loginName: "pemilik.baru",
            personId: fixture.people.owner.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(denied).toMatchObject({ _tag: "AccessDenied" });
        expect(
          yield* fixture.as("owner").mutation(issue, {
            loginName: "pemilik.baru",
            personId: fixture.people.owner.personId,
            slug: nf,
          })
        ).toMatchObject({ loginName: "pemilik.baru" });
      })
  );
});

describe("identity/cards reissue", () => {
  it.effect(
    "prints a new card that voids the old code and keeps the login name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* issueFirst(fixture);
        const second = yield* fixture
          .as("admin")
          .mutation(reissue, { personId: fixture.invited, slug: nf });
        expect(second).toMatchObject({
          code: expect.stringMatching(CODE_PATTERN),
          loginName: "guru.baru",
        });
        expect(second.code).not.toBe(first.code);
        expect(yield* redeemOn(fixture, first.code)).toEqual({
          outcome: "refused",
          reason: "invalid",
        });
        expect(yield* redeemOn(fixture, second.code)).toEqual({
          loginName: "guru.baru",
          outcome: "redeemed",
        });
      })
  );

  it.effect("refuses a reissue for a Person who has no login name", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const missing = yield* fixture
        .as("admin")
        .mutation(reissue, { personId: fixture.invited, slug: nf })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({ _tag: "LoginMissing" });
    })
  );

  it.effect("journals the reissue as a change of the same card", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* issueFirst(fixture);
      yield* fixture
        .as("admin")
        .mutation(reissue, { personId: fixture.invited, slug: nf });
      const entries = yield* fixture.run(journal);
      expect(Arr.map(entries, (entry) => entry.change)).toMatchObject([
        { card: expect.any(String), type: "login.card.issued" },
        { card: expect.any(String), type: "login.card.reissued" },
      ]);
      const cardIds = Arr.flatMap(entries, (entry) =>
        "card" in entry.change ? [entry.change.card] : []
      );
      expect(cardIds).toHaveLength(2);
      expect(cardIds[0]).toBe(cardIds[1]);
    })
  );
});
