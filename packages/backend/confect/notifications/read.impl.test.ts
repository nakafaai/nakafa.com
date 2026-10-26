import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import {
  addPerson,
  claim,
  consumeSchool,
  type Fixture,
  insertRows,
  inviteAt,
  NOW,
  nf,
  type PersonId,
  storedRows,
} from "@repo/backend/test/inbox";
import { scheduledJobs, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { readAll } = refs.public.notifications.inbox;
const readRun = refs.internal.notifications.read.run;
const READ_RUN = "notifications/read:run";

/** Fake timers keep the clock where each test sets it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** The arguments of a scheduled run that marks one page of a Person's rows. */
const ReadRunArgs = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  personId: Id("tenantPeople"),
  readAt: Schema.Finite,
});

/** The scheduled runs that mark read rows, as the system table lists them. */
const readRuns = (fixture: Fixture) =>
  fixture
    .run(scheduledJobs)
    .pipe(
      Effect.map((jobs) => Arr.filter(jobs, (job) => job.name === READ_RUN))
    );

/** Runs the scheduled read runs that exist now, the way the scheduler runs them after a request. */
const runReadRuns = (fixture: Fixture) =>
  Effect.gen(function* () {
    const jobs = yield* readRuns(fixture);
    yield* Effect.forEach(
      jobs,
      (job) =>
        Schema.decodeUnknownEffect(ReadRunArgs)(job.args[0]).pipe(
          Effect.flatMap((args) => fixture.internal.mutation(readRun, args))
        ),
      { discard: true }
    );
  });

describe("notifications/inbox readAll", () => {
  it.effect(
    "marks the account's unread rows read, and no other account's rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const budi = yield* fixture.account(
          "budi",
          "budi@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const budiNf = yield* addPerson(fixture, fixture.tenants.nf, "Budi");
        yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
        yield* inviteAt(fixture, "nf", budiNf, "budi@harapan.example.test");
        yield* consumeSchool(fixture, fixture.tenants.nf);
        yield* claim(fixture, anaNf, ana.userId);
        yield* claim(fixture, budiNf, budi.userId);
        const readAtsOf = (personId: PersonId) =>
          storedRows(fixture).pipe(
            Effect.map((rows) =>
              Arr.map(
                Arr.filter(rows, (row) => row.recipientPersonId === personId),
                (row) => row.readAt
              )
            )
          );
        vi.setSystemTime(NOW + 4000);
        yield* ana.client.mutation(readAll, {});
        yield* runReadRuns(fixture);
        expect(yield* readAtsOf(anaNf)).toEqual([NOW + 4000]);
        expect(yield* readAtsOf(budiNf)).toEqual([undefined]);
        vi.setSystemTime(NOW + 8000);
        yield* ana.client.mutation(readAll, {});
        yield* runReadRuns(fixture);
        expect(yield* readAtsOf(anaNf)).toEqual([NOW + 4000]);
      })
  );

  it.effect(
    "marks only the rows of the school a slug names, from that school's own inbox page",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const anaOther = yield* addPerson(
          fixture,
          fixture.tenants.other,
          "Ana"
        );
        yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
        yield* inviteAt(fixture, "other", anaOther, "ana@harapan.example.test");
        yield* consumeSchool(fixture, fixture.tenants.nf);
        yield* consumeSchool(fixture, fixture.tenants.other);
        yield* claim(fixture, anaNf, ana.userId);
        yield* claim(fixture, anaOther, ana.userId);
        vi.setSystemTime(NOW + 4000);
        yield* ana.client.mutation(readAll, { slug: nf });
        yield* runReadRuns(fixture);
        const rows = yield* storedRows(fixture);
        expect(
          Arr.map(rows, (row) => [row.recipientPersonId, row.readAt])
        ).toEqual(
          expect.arrayContaining([
            [anaNf, NOW + 4000],
            [anaOther, undefined],
          ])
        );
      })
  );

  it.effect(
    "marks a Person's rows one page in each scheduled run, and none in the request",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        yield* claim(fixture, anaNf, ana.userId);
        yield* insertRows(fixture, anaNf, fixture.tenants.nf, 51);
        vi.setSystemTime(NOW + 4000);
        yield* ana.client.mutation(readAll, {});
        const rowsOf = Effect.map(storedRows(fixture), (rows) =>
          Arr.filter(rows, (row) => row.recipientPersonId === anaNf)
        );
        expect(
          Arr.filter(yield* rowsOf, (row) => row.readAt === NOW + 4000)
        ).toHaveLength(0);
        const runs = yield* readRuns(fixture);
        expect(runs).toHaveLength(1);
        const first = yield* Schema.decodeUnknownEffect(ReadRunArgs)(
          runs[0]?.args[0]
        );
        expect(first.cursor).toBeNull();
        yield* fixture.internal.mutation(readRun, first);
        const afterFirstPage = yield* rowsOf;
        expect(afterFirstPage).toHaveLength(51);
        const markedByFirstPage = Arr.filter(
          afterFirstPage,
          (row) => row.readAt === NOW + 4000
        ).length;
        expect(markedByFirstPage).toBeGreaterThan(0);
        expect(markedByFirstPage).toBeLessThan(51);
        yield* runReadRuns(fixture);
        const afterRest = yield* rowsOf;
        expect(Arr.every(afterRest, (row) => row.readAt === NOW + 4000)).toBe(
          true
        );
      })
  );

  it.effect(
    "leaves unread a row that a later invitation writes, when the request's run runs after it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        yield* inviteAt(
          fixture,
          "nf",
          fixture.invited,
          "ana@harapan.example.test"
        );
        yield* consumeSchool(fixture, fixture.tenants.nf);
        yield* claim(fixture, fixture.invited, ana.userId);
        vi.setSystemTime(NOW + 4000);
        yield* ana.client.mutation(readAll, {});
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("users").get(ana.userId).pipe(Effect.orDie)
          )
        );
        yield* fixture.run(releaseTenantPeople(user, NOW + 5000));
        vi.setSystemTime(NOW + 6000);
        yield* inviteAt(
          fixture,
          "nf",
          fixture.invited,
          "satu@harapan.example.test"
        );
        yield* consumeSchool(fixture, fixture.tenants.nf);
        yield* runReadRuns(fixture);
        const rows = yield* storedRows(fixture);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.createdAt).toBeGreaterThan(NOW + 4000);
        expect(rows[0]?.readAt).toBeUndefined();
      })
  );

  it.effect("refuses a caller without a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture.anonymous
        .mutation(readAll, {})
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "SessionRequired" });
    })
  );
});
