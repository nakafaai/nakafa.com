import { beforeEach, describe, expect, it } from "@effect/vitest";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { purgeInbox } from "@repo/backend/confect/notifications/purge";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  journal,
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
const nf = slugOf("nf");
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const { invite } = refs.public.tenancy.invites;
const { remove } = refs.public.tenancy.people;
const consume = refs.internal.notifications.consume.run;
const purge = refs.internal.notifications.purge.run;
const PURGE_RUN = "notifications/purge:run";

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Every row of the inbox, oldest first. */
const notifications = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("notifications").index("by_creation_time").take(200)
    )
  );

/** The scheduled runs of the inbox purge, as the system table lists them. */
const purgeRuns = (fixture: Fixture) =>
  fixture
    .run(scheduledJobs)
    .pipe(Effect.map((jobs) => Arr.filter(jobs, (job) => job.name === PURGE_RUN)));

/**
 * Invites the fixture's unclaimed Person and runs the inbox once, so the Person
 * has its inbox row. The Person is then held by a new account, which is returned.
 */
const claimedInvitee = (fixture: Fixture) =>
  Effect.gen(function* () {
    yield* fixture.as("admin").mutation(invite, {
      email: guru,
      locale: "id",
      personId: fixture.invited,
      slug: nf,
    });
    yield* fixture.internal.mutation(consume, {
      tenantId: fixture.tenants.nf,
    });
    const account = yield* fixture.account(
      "guru",
      "guru@harapan.example.test",
      true
    );
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        writer.table("tenantPeople").patch(fixture.invited, {
          account: {
            claimedAt: NOW,
            method: "invite",
            state: "claimed",
            userId: account.userId,
          },
        })
      )
    );
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
    "account deletion releases the Person, deletes its inbox rows, and keeps the Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const userId = yield* claimedInvitee(fixture);
        expect(yield* notifications(fixture)).toHaveLength(1);
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("users").get(userId).pipe(Effect.orDie)
          )
        );
        yield* fixture.run(releaseTenantPeople(user, NOW + 1));
        expect(yield* notifications(fixture)).toEqual([]);
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
        expect(yield* notifications(fixture)).toHaveLength(1);
        yield* fixture.as("admin").mutation(remove, {
          personId: fixture.invited,
          slug: nf,
        });
        expect(yield* notifications(fixture)).toEqual([]);
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
        yield* fixture.as("admin").mutation(invite, {
          email: guru,
          locale: "id",
          personId: fixture.invited,
          slug: nf,
        });
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return;
        }
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(51, (index) => index),
              (index) =>
                writer.table("notifications").insert({
                  changeType: "person.invited",
                  createdAt: NOW + index,
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
        expect(yield* notifications(fixture)).toHaveLength(1);
        expect(yield* purgeRuns(fixture)).toHaveLength(1);
        yield* fixture.internal.mutation(purge, { personId: fixture.invited });
        expect(yield* notifications(fixture)).toEqual([]);
        expect(yield* purgeRuns(fixture)).toHaveLength(1);
      })
  );

  it.effect("schedules nothing when a Person's rows fit in one page", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* claimedInvitee(fixture);
      yield* fixture.run(purgeInbox(fixture.invited));
      expect(yield* notifications(fixture)).toEqual([]);
      expect(yield* purgeRuns(fixture)).toEqual([]);
    })
  );
});
