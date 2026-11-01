import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { CARD_TERM } from "@repo/backend/confect/identity/card";
import {
  CARD_NOW,
  CODE_PATTERN,
  issueFirst,
  nf,
  other,
  redeemOn,
} from "@repo/backend/test/identity";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

const TERM = Duration.toMillis(CARD_TERM);

/** Fake timers keep the clock at one moment, so the term of a card is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("identity/card term", () => {
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
          .mutation(enroll, { ...newStudent, unitId: fixture.units.smp });
        expect(enrolled).toEqual({
          code: expect.stringMatching(CODE_PATTERN),
          expiresAt: CARD_NOW + Duration.toMillis(CARD_TERM),
          loginName: "siswa.baru",
          personId: expect.any(String),
        });
        const grants = yield* fixture.run(activeGrants(enrolled.personId));
        expect(Arr.map(grants, (grant) => grant.scope)).toEqual([
          { kind: "unit", unitId: fixture.units.smp },
        ]);
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change.type)).toEqual([
          "person.created",
          "grant.created",
          "card.issued",
        ]);
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(listed.page).toContainEqual(
          expect.objectContaining({
            name: "Siswa Baru",
            removable: true,
            roles: ["student"],
            status: "cardIssued",
          })
        );
        const students = yield* fixture
          .as("admin")
          .query(refs.public.tenancy.people.students, {
            ...everyone,
            slug: nf,
          });
        expect(Arr.map(students.page, (student) => student.name)).toContain(
          "Siswa Baru"
        );
      })
  );

  it.effect(
    "refuses a login name the school cannot use, and leaves no Person behind",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture
          .as("admin")
          .mutation(enroll, { ...newStudent, unitId: fixture.units.smp });
        const taken = yield* fixture
          .as("admin")
          .mutation(enroll, {
            ...newStudent,
            unitId: fixture.units.smp,
            name: "Siswa Lain",
          })
          .pipe(Effect.flip);
        const malformed = yield* fixture
          .as("admin")
          .mutation(enroll, {
            ...newStudent,
            unitId: fixture.units.smp,
            loginName: "Siswa Lain!",
          })
          .pipe(Effect.flip);
        expect([taken, malformed]).toMatchObject([
          { _tag: "LoginNameTaken", code: "LOGIN_NAME_TAKEN" },
          { _tag: "LoginNameRefused", reason: "characters" },
        ]);
        expect(yield* fixture.run(journal)).toHaveLength(3);
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(
          Arr.filter(listed.page, (member) => member.name === "Siswa Lain")
        ).toEqual([]);
      })
  );

  it.effect("refuses a unit the school does not run, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const unitId = yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          yield* writer
            .table("tenantUnits")
            .patch(fixture.units.sd, { status: "archived" });
          return fixture.units.sd;
        })
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(enroll, { ...newStudent, unitId })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "AccessDenied",
        reason: "resource",
      });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("refuses a student of another school, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture
        .as("admin")
        .mutation(enroll, {
          ...newStudent,
          unitId: fixture.units.smp,
          slug: other,
        })
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
        .mutation(enroll, { ...newStudent, unitId: fixture.units.smp })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );
});
