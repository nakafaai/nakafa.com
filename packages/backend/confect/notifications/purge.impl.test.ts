import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import { purgeInbox } from "@repo/backend/confect/notifications/purge";
import {
  claim,
  consumeSchool,
  type Fixture,
  inviteAt,
  NOW,
  storedRows,
} from "@repo/backend/test/inbox";
import {
  journal,
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const GURU = "guru@harapan.example.test";
const { remove } = refs.public.tenancy.people;
const { revoke } = refs.public.tenancy.invites;
const purge = refs.internal.notifications.purge.run;
const PURGE_RUN = "notifications/purge:run";

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** The scheduled runs of the inbox purge, as the system table lists them. */
const purgeRuns = (fixture: Fixture) =>
  fixture
    .run(scheduledJobs)
    .pipe(
      Effect.map((jobs) => Arr.filter(jobs, (job) => job.name === PURGE_RUN))
    );

/**
 * Invites the fixture's unclaimed Person and runs the inbox once, so the Person
 * has its inbox row. The Person is then held by a new account, which is returned.
 */
const claimedInvitee = (fixture: Fixture) =>
  Effect.gen(function* () {
    yield* inviteAt(fixture, "nf", fixture.invited, GURU);
    yield* consumeSchool(fixture, fixture.tenants.nf);
    const account = yield* fixture.account("guru", GURU, true);
    yield* claim(fixture, fixture.invited, account.userId);
    return account.userId;
  });

/** The Person row of the fixture's invitee, as stored. */
const invitee = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantPeople").get(fixture.invited).pipe(Effect.orDie)
    )
  );

describe("notifications/purge", () => {
  it.effect(
    "deletes the row of an invitation when the invitation is revoked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toHaveLength(1);
        yield* fixture.as("admin").mutation(revoke, {
          inviteId: made.id,
          slug: nf,
        });
        expect(yield* storedRows(fixture)).toEqual([]);
      })
  );

  it.effect(
    "account deletion releases the Person, deletes its inbox rows, and keeps the Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const userId = yield* claimedInvitee(fixture);
        expect(yield* storedRows(fixture)).toHaveLength(1);
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("users").get(userId).pipe(Effect.orDie)
          )
        );
        yield* fixture.run(releaseTenantPeople(user, NOW + 1));
        expect(yield* storedRows(fixture)).toEqual([]);
        expect(yield* invitee(fixture)).toMatchObject({
          account: { state: "unclaimed" },
          status: "active",
        });
      })
  );

  it.effect(
    "removing a Person deletes its inbox rows, and the Person row stays",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* claimedInvitee(fixture);
        expect(yield* storedRows(fixture)).toHaveLength(1);
        yield* fixture.as("admin").mutation(remove, {
          personId: fixture.invited,
          slug: nf,
        });
        expect(yield* storedRows(fixture)).toEqual([]);
        expect(yield* invitee(fixture)).toMatchObject({
          account: { state: "unclaimed" },
          status: "removed",
        });
      })
  );

  it.effect(
    "deletes the rest of a Person's rows in a scheduled run when they exceed one page",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return yield* Effect.die(
            "The invite must have written a journal entry."
          );
        }
        // More rows than one page holds, so the release leaves some for a later run.
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(51, (index) => index),
              (index) =>
                writer.table("notifications").insert({
                  changeType: "person.invited",
                  createdAt: NOW + index,
                  inviteId: made.id,
                  journalEntryId: entry._id,
                  recipientPersonId: fixture.invited,
                  subject: { id: fixture.invited, kind: "person" },
                  tenantId: fixture.tenants.nf,
                }),
              { discard: true }
            )
          )
        );
        yield* fixture.as("admin").mutation(remove, {
          personId: fixture.invited,
          slug: nf,
        });
        const left = (yield* storedRows(fixture)).length;
        expect(left).toBeGreaterThan(0);
        expect(left).toBeLessThan(51);
        expect(yield* purgeRuns(fixture)).toHaveLength(1);
        yield* fixture.internal.mutation(purge, { personId: fixture.invited });
        expect(yield* storedRows(fixture)).toEqual([]);
        expect(yield* purgeRuns(fixture)).toHaveLength(1);
      })
  );

  it.effect("schedules nothing when a Person's rows fit in one page", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* claimedInvitee(fixture);
      yield* fixture.run(purgeInbox(fixture.invited));
      expect(yield* storedRows(fixture)).toEqual([]);
      expect(yield* purgeRuns(fixture)).toEqual([]);
    })
  );
});
