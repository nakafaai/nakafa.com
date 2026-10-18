import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CARD_NOW,
  inviteePerson,
  issueFirst,
  nf,
  other,
  redeemOn,
  reissue,
} from "@repo/backend/test/identity";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Struct } from "effect";

const { list } = refs.public.identity.logins;
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

describe("identity/logins usernameOf", () => {
  /** The Better Auth username of a school login, as the school host's sign-in reads it. */
  const usernameOf = (
    fixture: Effect.Success<typeof tenancyFixture>,
    loginName: string,
    slug = nf
  ) =>
    fixture.internal.query(refs.internal.identity.logins.usernameOf, {
      loginName,
      slug,
    });

  it.effect(
    "answers the username of a claimed login, read with the typed name's capitals and spaces",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        expect(yield* usernameOf(fixture, " Guru.Baru ")).toEqual({
          outcome: "found",
          username: "invited",
        });
      })
  );

  it.effect(
    "answers missing for a login without an account, a name the school cannot hold, and another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* issueFirst(fixture);
        expect(yield* usernameOf(fixture, "guru.baru")).toEqual({
          outcome: "missing",
        });
        expect(yield* usernameOf(fixture, "x")).toEqual({ outcome: "missing" });
        expect(yield* usernameOf(fixture, "guru.baru", other)).toEqual({
          outcome: "missing",
        });
      })
  );

  it.effect("answers missing for a school address that names no school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      yield* redeemOn(fixture, issued.code);
      expect(yield* usernameOf(fixture, "guru.baru", slugOf("nope"))).toEqual({
        outcome: "missing",
      });
    })
  );

  it.effect(
    "answers missing for a claimed account whose app user holds no username",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const issued = yield* issueFirst(fixture);
        yield* redeemOn(fixture, issued.code);
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const person = yield* reader
              .table("tenantPeople")
              .get(fixture.invited)
              .pipe(Effect.orDie);
            if (person.account.state !== "claimed") {
              return;
            }
            const user = yield* reader
              .table("users")
              .get(person.account.userId)
              .pipe(Effect.orDie);
            yield* writer
              .table("users")
              .replace(
                user._id,
                Struct.omit(user, ["_creationTime", "_id", "username"])
              )
              .pipe(Effect.orDie);
          })
        );
        expect(yield* usernameOf(fixture, "guru.baru")).toEqual({
          outcome: "missing",
        });
      })
  );

  it.effect.each(["suspended", "removed"] as const)(
    "answers missing for a %s Person, whose account can no longer sign in",
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
        expect(yield* usernameOf(fixture, "guru.baru")).toEqual({
          outcome: "missing",
        });
      })
  );
});
