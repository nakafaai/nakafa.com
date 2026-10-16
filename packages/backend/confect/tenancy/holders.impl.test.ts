import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CLAIM_PAGE_SIZE } from "@repo/backend/confect/tenancy/claims";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { MASCOT } from "@repo/backend/test/mascot";
import {
  invitePerson,
  scheduledJobs,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const address = Schema.decodeSync(Email)("guru@harapan.example.test");
const other = Schema.decodeSync(Email)("lain@harapan.example.test");
const schedule = refs.internal.tenancy.holders.schedule;
const run = refs.internal.tenancy.claims.run;

/** Fake timers keep every scheduled run from starting before the test starts it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** The jobs of one function that earlier writes scheduled. */
const jobsOf = (name: "tenancy/claims:run" | "tenancy/holders:schedule") =>
  Effect.map(scheduledJobs, (jobs) =>
    Arr.filter(jobs, (job) => job.name === name)
  );

/** The accounts that the claim runs scheduled so far are for. */
const scheduledRuns = Effect.map(jobsOf("tenancy/claims:run"), (jobs) =>
  Arr.map(jobs, (job) => job.args[0].userId)
);

/**
 * An account row that holds an address without a Better Auth user behind it:
 * the row that stays while an account is being deleted, or any other account
 * row. Better Auth keeps one user for an address, so only rows like this one
 * can share it.
 */
const bareAccount = (index: number, deleting: boolean) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer.table("users").insert({
      authId: `bare-${index}`,
      credits: 0,
      creditsResetAt: 0,
      ...(deleting ? { deletionPreparedAt: NOW } : {}),
      email: address,
      mascot: MASCOT,
      name: `Bare ${index}`,
      plan: "free",
    })
  );

describe("tenancy/holders schedule", () => {
  it.effect(
    "schedules a run for every account that holds the address, however many of them are being deleted",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const leaving = yield* fixture.run(
          Effect.forEach([1, 2], (index) => bareAccount(index, true))
        );
        const guru = yield* fixture.account("guru", address, true);
        yield* fixture.account("lain", other, true);
        const { personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        yield* fixture.internal.mutation(schedule, {
          cursor: null,
          email: address,
        });
        const scheduled = yield* fixture.run(scheduledRuns);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          userId: guru.userId,
        });
        const person = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(personId)
          )
        );
        expect(scheduled).toHaveLength(3);
        expect(scheduled).toEqual(
          expect.arrayContaining([...leaving, guru.userId])
        );
        expect(person.account).toMatchObject({
          state: "claimed",
          userId: guru.userId,
        });
      })
  );

  it.effect("schedules nothing when no account holds the address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.account("lain", other, true);
      yield* fixture.internal.mutation(schedule, {
        cursor: null,
        email: address,
      });
      expect(yield* fixture.run(scheduledJobs)).toEqual([]);
    })
  );

  it.effect(
    "walks every account that holds the address, a page at a time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const accounts = yield* fixture.run(
          Effect.forEach(Arr.range(1, CLAIM_PAGE_SIZE + 1), (index) =>
            bareAccount(index, false)
          )
        );
        yield* fixture.internal.mutation(schedule, {
          cursor: null,
          email: address,
        });
        const firstPage = yield* fixture.run(scheduledRuns);
        const next = yield* fixture.run(jobsOf("tenancy/holders:schedule"));
        yield* fixture.internal.mutation(schedule, {
          cursor: next[0]?.args[0].cursor,
          email: address,
        });
        const secondPage = yield* fixture.run(scheduledRuns);
        expect(firstPage).toHaveLength(CLAIM_PAGE_SIZE);
        expect(next).toHaveLength(1);
        expect(secondPage).toHaveLength(CLAIM_PAGE_SIZE + 1);
        expect(secondPage).toEqual(expect.arrayContaining(accounts));
      })
  );
});
