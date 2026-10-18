import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  CARD_NOW,
  inviteePerson,
  issueFirst,
  nf,
  reissue,
} from "@repo/backend/test/identity";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

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
