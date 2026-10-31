import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Email, INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const HOUR = Duration.toMillis(Duration.hours(1));
const TERM = Duration.toMillis(INVITE_TERM);
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const lain = Schema.decodeSync(Email)("lain@lain.example.test");
const benar = Schema.decodeSync(Email)("benar@harapan.example.test");
const nf = slugOf("nf");
const { invite, list, readdress, revoke } = refs.public.tenancy.invites;
const { setPolicy } = refs.public.tenancy.settings;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** Fake timers keep every scheduled job from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** Invites the fixture's unclaimed Person at an address, as the school's Admin. */
const inviteInvited = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.as("admin").mutation(invite, {
    email: guru,
    locale: "id",
    personId: fixture.invited,
    slug: nf,
  });

describe("tenancy/invites readdress", () => {
  it.effect(
    "ends the mistyped invite and sends a new one with a fresh term, and the same address changes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const made = yield* inviteInvited(fixture);
        vi.setSystemTime(NOW + HOUR);
        const same = yield* admin.mutation(readdress, {
          email: guru,
          inviteId: made.id,
          locale: "id",
          slug: nf,
        });
        expect(same).toEqual(made);
        const corrected = yield* admin.mutation(readdress, {
          email: benar,
          inviteId: made.id,
          locale: "id",
          slug: nf,
        });
        expect(corrected).toMatchObject({
          email: benar,
          expiresAt: NOW + HOUR + TERM,
          personId: fixture.invited,
          status: "pending",
        });
        expect(corrected.id).not.toBe(made.id);
        const listed = yield* admin.query(list, { ...firstPage, slug: nf });
        expect(Arr.map(listed.page, (row) => row.id)).toEqual([corrected.id]);
      })
  );

  it.effect(
    "refuses an address the school does not admit, an expired invite, a revoked invite, and a teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const made = yield* inviteInvited(fixture);
        const args = {
          email: benar,
          inviteId: made.id,
          locale: "id",
          slug: nf,
        } as const;
        yield* admin.mutation(setPolicy, {
          policy: { key: "emailDomains", value: ["harapan.example.test"] },
          slug: nf,
        });
        const domain = yield* admin
          .mutation(readdress, { ...args, email: lain })
          .pipe(Effect.flip);
        const teacher = yield* fixture
          .as("teacher")
          .mutation(readdress, args)
          .pipe(Effect.flip);
        vi.setSystemTime(NOW + TERM);
        const ended = yield* admin.mutation(readdress, args).pipe(Effect.flip);
        vi.setSystemTime(NOW);
        yield* admin.mutation(revoke, { inviteId: made.id, slug: nf });
        const revoked = yield* admin
          .mutation(readdress, args)
          .pipe(Effect.flip);
        expect([domain, teacher, ended, revoked]).toMatchObject([
          { _tag: "InviteDomainRefused" },
          denied("role"),
          { _tag: "InviteExpired" },
          { _tag: "InviteNotPending" },
        ]);
      })
  );

  it.effect(
    "refuses to readdress the invite of a Person who has an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteInvited(fixture);
        yield* fixture.run(
          Effect.gen(function* () {
            const owner = yield* (yield* DatabaseReader)
              .table("tenantPeople")
              .get(fixture.people.owner.personId);
            yield* (yield* DatabaseWriter)
              .table("tenantPeople")
              .patch(fixture.invited, { account: owner.account });
          })
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(readdress, {
            email: benar,
            inviteId: made.id,
            locale: "id",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "PersonClaimed" });
      })
  );
});
