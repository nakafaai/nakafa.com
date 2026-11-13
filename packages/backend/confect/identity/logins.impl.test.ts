import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { loginAccountOf } from "@repo/backend/confect/identity/logins";
import {
  CARD_NOW,
  inviteePerson,
  issueFirst,
  nf,
  redeemOn,
  reissue,
} from "@repo/backend/test/identity";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { list, rename } = refs.public.identity.logins;
const firstPage = { cursor: null, numItems: 25 };
const denied = {
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason: "role",
};

/** Fake timers keep the clock at one moment, so each login's issue time is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("identity/logins list", () => {
  it.effect(
    "finds the login of a person a search names, and skips a person with none",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture, "guru.baru");
        const invitee = yield* inviteePerson(fixture);
        const admin = fixture.as("admin");
        const found = yield* admin.query(list, {
          paginationOpts: firstPage,
          search: invitee.name,
          slug: nf,
        });
        expect(found.page).toMatchObject([{ loginName: "guru.baru" }]);
        const none = yield* admin.query(list, {
          paginationOpts: firstPage,
          search: "Teacher",
          slug: nf,
        });
        expect(none.page).toEqual([]);
      })
  );

  it.effect(
    "lists each school login with its Person and the time its login was issued",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture, "guru.baru");
        const invitee = yield* inviteePerson(fixture);
        const answer = yield* fixture
          .as("admin")
          .query(list, { paginationOpts: firstPage, slug: nf });
        expect(answer.page).toEqual([
          {
            issuedAt: expect.any(Number),
            loginName: "guru.baru",
            person: { id: fixture.invited, name: invitee.name },
          },
        ]);
        expect(
          Arr.map(answer.page, (login) => Math.floor(login.issuedAt))
        ).toEqual([CARD_NOW]);
      })
  );

  it.effect("keeps the issue time of a login when its card is reissued", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* issueFirst(fixture, "guru.baru");
      vi.setSystemTime(CARD_NOW + 60_000);
      yield* fixture
        .as("admin")
        .mutation(reissue, { personId: fixture.invited, slug: nf });
      const answer = yield* fixture
        .as("admin")
        .query(list, { paginationOpts: firstPage, slug: nf });
      expect(
        Arr.map(answer.page, (login) => Math.floor(login.issuedAt))
      ).toEqual([CARD_NOW]);
    })
  );

  it.effect("refuses a teacher, who does not hold tenant.manage", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* issueFirst(fixture, "guru.baru");
      const denial = yield* fixture
        .as("teacher")
        .query(list, { paginationOpts: firstPage, slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied);
    })
  );
});

describe("identity/logins rename", () => {
  /** Whether the school host's sign-in finds an account for the typed login name. */
  const signsIn = (
    fixture: Effect.Success<typeof tenancyFixture>,
    loginName: string
  ) =>
    // The run's answer crosses Convex's serialization, which keeps no Option, so
    // the answer is read inside the run.
    fixture.run(loginAccountOf(nf, loginName).pipe(Effect.map(Option.isSome)));

  it.effect(
    "renames a claimed login, read as typed, which then signs in by its new name only, and records the rename once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        const before = Arr.length(yield* fixture.run(journal));
        const renamed = yield* fixture.as("admin").mutation(rename, {
          loginName: " Siswa.Baru ",
          personId: fixture.invited,
          slug: nf,
        });
        const again = yield* fixture.as("admin").mutation(rename, {
          loginName: "siswa.baru",
          personId: fixture.invited,
          slug: nf,
        });
        const listed = yield* fixture
          .as("admin")
          .query(list, { paginationOpts: firstPage, slug: nf });
        const entries = Arr.drop(yield* fixture.run(journal), before);
        expect([renamed, again]).toEqual(["siswa.baru", "siswa.baru"]);
        expect(Arr.map(listed.page, (login) => login.loginName)).toEqual([
          "siswa.baru",
        ]);
        expect(yield* signsIn(fixture, "siswa.baru")).toBe(true);
        expect(yield* signsIn(fixture, "guru.baru")).toBe(false);
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "login.renamed" },
            subject: { id: fixture.invited, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "refuses a name another Person holds, a name the school cannot hold, a Person without a login, and a teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        yield* fixture.as("admin").mutation(refs.public.identity.cards.enroll, {
          loginName: "siswa.lain",
          name: "Siswa Lain",
          slug: nf,
          unitId: fixture.units.smp,
        });
        const admin = fixture.as("admin");
        const taken = yield* admin
          .mutation(rename, {
            loginName: "siswa.lain",
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        const refused = yield* admin
          .mutation(rename, {
            loginName: "x",
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        const missing = yield* admin
          .mutation(rename, {
            loginName: "siswa.lama",
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const teacher = yield* fixture
          .as("teacher")
          .mutation(rename, {
            loginName: "siswa.lama",
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([taken, refused, missing, teacher]).toMatchObject([
          { _tag: "LoginNameTaken" },
          { _tag: "LoginNameRefused", reason: "length" },
          { _tag: "LoginMissing" },
          denied,
        ]);
      })
  );
});
