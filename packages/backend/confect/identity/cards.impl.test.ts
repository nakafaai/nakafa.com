import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CARD_TERM } from "@repo/backend/confect/identity/card";
import { hashCardCode } from "@repo/backend/confect/identity/code";
import {
  CARD_NOW,
  CODE_PATTERN,
  cardRowOf,
  claimInviteeByInvite,
  issue,
  issueFirst,
  nf,
  other,
  redeemOn,
  reissue,
} from "@repo/backend/test/identity";
import { grantRole, journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const TERM = Duration.toMillis(CARD_TERM);

/** Fake timers keep the clock at one moment, so every term and limit is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

/**
 * An unclaimed Person of the fixture's school who holds the Owner role, so that
 * no card may be printed for it.
 */
const unclaimedOwner = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.run(
    Effect.gen(function* () {
      const personId = yield* (yield* DatabaseWriter)
        .table("tenantPeople")
        .insert({
          account: { state: "unclaimed" },
          kind: "member",
          name: "Pemilik Baru",
          status: "active",
          tenantId: fixture.tenants.nf,
        });
      yield* grantRole(fixture.tenants.nf, personId, "owner", {
        kind: "tenant",
      });
      return personId;
    })
  );

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
            change: { type: "card.issued" },
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
    "refuses a first card for a Person who already has an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = yield* fixture
          .as("admin")
          .mutation(issue, {
            loginName: "siswa.baru",
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "PersonClaimed" });
      })
  );

  it.effect(
    "refuses a card for a Person who holds the Owner or Admin role, from any caller",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = yield* unclaimedOwner(fixture);
        const byAdmin = yield* fixture
          .as("admin")
          .mutation(issue, {
            loginName: "pemilik.baru",
            personId: owner,
            slug: nf,
          })
          .pipe(Effect.flip);
        const byOwner = yield* fixture
          .as("owner")
          .mutation(issue, {
            loginName: "pemilik.baru",
            personId: owner,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([byAdmin, byOwner]).toMatchObject([
          { _tag: "CardRoleRefused" },
          { _tag: "CardRoleRefused" },
        ]);
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

  it.effect(
    "refuses a reissue from a caller without the card right, and from another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        const student = yield* fixture
          .as("student")
          .mutation(reissue, { personId: fixture.invited, slug: nf })
          .pipe(Effect.flip);
        const otherSchool = yield* fixture
          .as("otherOwner")
          .mutation(reissue, { personId: fixture.invited, slug: other })
          .pipe(Effect.flip);
        expect([student, otherSchool]).toMatchObject([
          { _tag: "AccessDenied", reason: "role" },
          { _tag: "AccessDenied", reason: "resource" },
        ]);
      })
  );

  it.effect(
    "refuses a reissue once the Person holds the Admin role, and voids nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        const before = yield* cardRowOf(fixture, fixture.invited);
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "admin", {
            kind: "tenant",
          })
        );
        const refused = yield* fixture
          .as("owner")
          .mutation(reissue, { personId: fixture.invited, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CardRoleRefused" });
        expect(yield* cardRowOf(fixture, fixture.invited)).toEqual(before);
      })
  );

  it.effect(
    "refuses a reissue for a Person whom an invite claimed after the card was printed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        yield* claimInviteeByInvite(fixture);
        const refused = yield* fixture
          .as("admin")
          .mutation(reissue, { personId: fixture.invited, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "PersonClaimed" });
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
        { card: expect.any(String), type: "card.issued" },
        { card: expect.any(String), type: "card.reissued" },
      ]);
      const cardIds = Arr.flatMap(entries, (entry) =>
        "card" in entry.change ? [entry.change.card] : []
      );
      expect(cardIds).toHaveLength(2);
      expect(cardIds[0]).toBe(cardIds[1]);
    })
  );
});

describe("identity/cards enroll", () => {
  const { enroll } = refs.public.identity.cards;
  const { members } = refs.public.tenancy.roster;
  const everyone = { paginationOpts: { cursor: null, numItems: 100 } };
  const denied = (reason: "role") => ({
    _tag: "AccessDenied",
    code: "ACCESS_DENIED",
    reason,
  });
  const newStudent = {
    loginName: "siswa.baru",
    name: "Siswa Baru",
    slug: nf,
  } as const;

  it.effect(
    "adds a student with the first card in one step, and journals the Person and the card",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const enrolled = yield* fixture
          .as("admin")
          .mutation(enroll, newStudent);
        expect(enrolled).toEqual({
          code: expect.stringMatching(CODE_PATTERN),
          expiresAt: CARD_NOW + Duration.toMillis(CARD_TERM),
          loginName: "siswa.baru",
        });
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change.type)).toEqual([
          "person.created",
          "card.issued",
        ]);
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(listed.page).toContainEqual({
          id: expect.any(String),
          name: "Siswa Baru",
          roles: [],
          status: "cardIssued",
        });
      })
  );

  it.effect(
    "refuses a login name the school cannot use, and leaves no Person behind",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.as("admin").mutation(enroll, newStudent);
        const taken = yield* fixture
          .as("admin")
          .mutation(enroll, { ...newStudent, name: "Siswa Lain" })
          .pipe(Effect.flip);
        const malformed = yield* fixture
          .as("admin")
          .mutation(enroll, { ...newStudent, loginName: "Siswa Lain!" })
          .pipe(Effect.flip);
        expect([taken, malformed]).toMatchObject([
          { _tag: "LoginNameTaken", code: "LOGIN_NAME_TAKEN" },
          { _tag: "LoginNameRefused", reason: "characters" },
        ]);
        expect(yield* fixture.run(journal)).toHaveLength(2);
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(
          Arr.filter(listed.page, (member) => member.name === "Siswa Lain")
        ).toEqual([]);
      })
  );

  it.effect("refuses a student of another school, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture
        .as("admin")
        .mutation(enroll, { ...newStudent, slug: other })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotMember" });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("refuses a student card by a teacher, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture
        .as("teacher")
        .mutation(enroll, newStudent)
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );
});
