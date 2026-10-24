import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { Email, INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const HOUR = Duration.toMillis(Duration.hours(1));
/** The gap between two resends when three are allowed in an hour. */
const RESEND_GAP = HOUR / 3;
const TERM = Duration.toMillis(INVITE_TERM);
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const lain = Schema.decodeSync(Email)("lain@lain.example.test");
const nf = slugOf("nf");
const { invite, list, resend, revoke } = refs.public.tenancy.invites;
const expire = refs.internal.tenancy.expiry.invite;
const holdersSchedule = refs.internal.tenancy.holders.schedule;
const claimsRun = refs.internal.tenancy.claims.run;
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
const inviteInvited = (
  fixture: Effect.Success<typeof tenancyFixture>,
  email = guru,
  locale: "de" | "en" | "id" = "id"
) =>
  fixture.as("admin").mutation(invite, {
    email,
    locale,
    personId: fixture.invited,
    slug: nf,
  });

describe("tenancy/invites invite", () => {
  it.effect(
    "invites an unclaimed Person, sets the expiry, and schedules it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteInvited(fixture);
        expect(made).toEqual({
          email: guru,
          expiresAt: NOW + TERM,
          id: expect.any(String),
          name: "Invited",
          personId: fixture.invited,
          roles: [],
          status: "pending",
        });
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.filter(jobs, (job) => job.name === "tenancy/expiry:invite")
        ).toMatchObject([
          {
            args: [{ inviteId: made.id }],
            scheduledTime: NOW + TERM,
          },
        ]);
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { invite: made.id, type: "person.invited" },
            subject: { id: fixture.invited, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "refuses an address the school does not admit, and a second pending invite",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenants").patch(fixture.tenants.nf, {
              policies: {
                ...NEW_TENANT_POLICIES,
                emailDomains: ["harapan.example.test"],
              },
            })
          )
        );
        const refused = yield* inviteInvited(fixture, lain).pipe(Effect.flip);
        yield* inviteInvited(fixture);
        const pending = yield* inviteInvited(fixture).pipe(Effect.flip);
        expect([refused, pending]).toMatchObject([
          { _tag: "InviteDomainRefused" },
          { _tag: "InvitePending" },
        ]);
      })
  );

  it.effect("refuses to invite a Person who already has an account", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const claimed = yield* fixture
        .as("admin")
        .mutation(invite, {
          email: guru,
          locale: "id",
          personId: fixture.people.teacher.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(claimed).toMatchObject({ _tag: "PersonClaimed" });
    })
  );

  it.effect(
    "claims the invite at once for an account that holds the address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", guru, true);
        const made = yield* inviteInvited(fixture);
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.filter(jobs, (job) => job.name === "tenancy/holders:schedule")
        ).toHaveLength(1);
        yield* fixture.internal.mutation(holdersSchedule, {
          cursor: null,
          email: guru,
        });
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const after = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(fixture.invited)
          )
        );
        expect(after.account).toMatchObject({
          method: "invite",
          state: "claimed",
          userId: account.userId,
        });
        expect(made.personId).toBe(fixture.invited);
      })
  );
});

describe("tenancy/invites resend and expiry", () => {
  it.effect(
    "sends a pending invite again, at most three times in any hour per Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteInvited(fixture);
        const sendAt = (at: number) => {
          vi.setSystemTime(at);
          return fixture
            .as("admin")
            .mutation(resend, { inviteId: made.id, locale: "en", slug: nf });
        };
        const first = yield* sendAt(NOW);
        const burst = yield* sendAt(NOW).pipe(Effect.flip);
        const early = yield* sendAt(NOW + RESEND_GAP - 1).pipe(Effect.flip);
        const second = yield* sendAt(NOW + RESEND_GAP);
        const third = yield* sendAt(NOW + 2 * RESEND_GAP);
        const fullHour = yield* sendAt(NOW + HOUR - 1).pipe(Effect.flip);
        const nextHour = yield* sendAt(NOW + HOUR);
        expect(
          Arr.map([first, second, third, nextHour], (row) => row.id)
        ).toEqual([made.id, made.id, made.id, made.id]);
        expect([burst, early, fullHour]).toMatchObject([
          { _tag: "InviteRateLimited" },
          { _tag: "InviteRateLimited" },
          { _tag: "InviteRateLimited" },
        ]);
        expect(
          Arr.length(
            Arr.filter(
              yield* fixture.run(journal),
              (entry) => entry.change.type === "invite.resent"
            )
          )
        ).toBe(4);
      })
  );

  it.effect(
    "refuses to send again an invite that expired, by its date or its state",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const byDate = yield* inviteInvited(fixture);
        vi.setSystemTime(NOW + TERM);
        const pastDate = yield* fixture
          .as("admin")
          .mutation(resend, { inviteId: byDate.id, locale: "en", slug: nf })
          .pipe(Effect.flip);
        const byState = yield* fixture.internal.mutation(expire, {
          inviteId: byDate.id,
        });
        const expiredState = yield* fixture
          .as("admin")
          .mutation(resend, { inviteId: byDate.id, locale: "en", slug: nf })
          .pipe(Effect.flip);
        expect(pastDate).toMatchObject({ _tag: "InviteExpired" });
        expect(byState).toBeNull();
        expect(expiredState).toMatchObject({ _tag: "InviteExpired" });
      })
  );

  it.effect("refuses to send again an invite that was revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* inviteInvited(fixture);
      yield* fixture
        .as("admin")
        .mutation(revoke, { inviteId: made.id, slug: nf });
      const refused = yield* fixture
        .as("admin")
        .mutation(resend, { inviteId: made.id, locale: "en", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "InviteNotPending" });
    })
  );

  it.effect("invites a Person again after the last invite expired", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const first = yield* inviteInvited(fixture);
      yield* fixture.internal.mutation(expire, { inviteId: first.id });
      vi.setSystemTime(NOW + TERM);
      const second = yield* inviteInvited(fixture);
      expect(second.id).not.toBe(first.id);
      expect(second.expiresAt).toBe(NOW + TERM + TERM);
    })
  );

  it.effect(
    "invites a Person again once the last invite's term has ended, before its expiry job ran",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* inviteInvited(fixture);
        vi.setSystemTime(NOW + TERM);
        const second = yield* inviteInvited(fixture);
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantInvites").get(first.id)
          )
        );
        expect(stored.state).toMatchObject({ status: "expired" });
        expect(second.id).not.toBe(first.id);
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "person" },
            change: { invite: first.id, type: "person.invited" },
          },
          {
            actor: { kind: "system" },
            change: { invite: first.id, type: "invite.expired" },
          },
          {
            actor: { kind: "person" },
            change: { invite: second.id, type: "person.invited" },
          },
        ]);
      })
  );

  it.effect(
    "claims a new invite once the last one expired, for an account that holds the address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", guru, true);
        const first = yield* inviteInvited(fixture);
        yield* fixture.internal.mutation(expire, { inviteId: first.id });
        vi.setSystemTime(NOW + TERM);
        yield* inviteInvited(fixture);
        yield* fixture.internal.mutation(holdersSchedule, {
          cursor: null,
          email: guru,
        });
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const after = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(fixture.invited)
          )
        );
        expect(after.account).toMatchObject({
          method: "invite",
          state: "claimed",
          userId: account.userId,
        });
      })
  );

  it.effect("refuses a resend by a Teacher of the same school, by role", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* inviteInvited(fixture);
      const refused = yield* fixture
        .as("teacher")
        .mutation(resend, { inviteId: made.id, locale: "en", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
    })
  );

  it.effect(
    "refuses to send again an invite whose Person already holds an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteInvited(fixture);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").patch(made.personId, {
              account: {
                claimedAt: NOW,
                method: "invite",
                state: "claimed",
                userId: fixture.users.stranger.userId,
              },
            })
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(resend, { inviteId: made.id, locale: "en", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "PersonClaimed" });
        expect(
          Arr.filter(
            yield* fixture.run(journal),
            (entry) => entry.change.type === "invite.resent"
          )
        ).toEqual([]);
      })
  );
});

describe("tenancy/invites owner, unit admin, and tenants", () => {
  it.effect(
    "lets the Owner invite, and refuses a unit's Admin, a teacher, and a non-member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const asked = (account: "stranger" | "teacher" | "unitAdmin") =>
          fixture
            .as(account)
            .mutation(invite, {
              email: lain,
              locale: "id",
              personId: fixture.invited,
              slug: nf,
            })
            .pipe(Effect.flip);
        const owned = yield* fixture.as("owner").mutation(invite, {
          email: guru,
          locale: "id",
          personId: fixture.invited,
          slug: nf,
        });
        const refusals = yield* Effect.all([
          asked("unitAdmin"),
          asked("teacher"),
          asked("stranger"),
        ]);
        expect(owned).toMatchObject({ email: guru, personId: fixture.invited });
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          { _tag: "NotMember", code: "NOT_MEMBER" },
        ]);
      })
  );

  it.effect(
    "refuses a Person, an invite, and the invites list of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture.run(
          invitePerson(fixture.tenants.other, lain)
        );
        const admin = fixture.as("admin");
        const refusals = yield* Effect.all([
          admin
            .mutation(invite, {
              email: guru,
              locale: "id",
              personId: fixture.people.otherOwner.personId,
              slug: nf,
            })
            .pipe(Effect.flip),
          admin
            .mutation(revoke, { inviteId: foreign.inviteId, slug: nf })
            .pipe(Effect.flip),
          admin
            .mutation(resend, {
              inviteId: foreign.inviteId,
              locale: "en",
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        const listed = yield* admin.query(list, { ...firstPage, slug: nf });
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
          denied("resource"),
        ]);
        expect(Arr.map(listed.page, (row) => row.id)).not.toContain(
          foreign.inviteId
        );
      })
  );
});
