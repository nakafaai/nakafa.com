import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  claimAfterInvite,
  claimAfterVerification,
} from "@repo/backend/confect/tenancy/claims";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  scheduledJobs,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const address = Schema.decodeSync(Email)("guru@harapan.example.test");
const other = Schema.decodeSync(Email)("lain@harapan.example.test");

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
});

/** The arguments of the jobs of one function that earlier writes scheduled. */
const jobsOf = (name: "tenancy/claims:run" | "tenancy/holders:schedule") =>
  Effect.map(scheduledJobs, (jobs) =>
    Arr.map(
      Arr.filter(jobs, (job) => job.name === name),
      (job) => job.args
    )
  );

/** The claim runs that earlier writes scheduled, by the account they are for. */
const claimJobs = jobsOf("tenancy/claims:run");

describe("tenancy/claims after verification", () => {
  it.effect("schedules the claim when an invite waits for the address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      yield* fixture.run(invitePerson(fixture.tenants.nf, address));
      yield* fixture.run(claimAfterVerification(account.userId, address));
      expect(yield* fixture.run(claimJobs)).toEqual([
        [{ cursor: null, userId: account.userId }],
      ]);
    })
  );

  it.effect("schedules nothing when no invite waits for the address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      yield* fixture.run(invitePerson(fixture.tenants.nf, other));
      yield* fixture.run(claimAfterVerification(account.userId, address));
      expect(yield* fixture.run(claimJobs)).toEqual([]);
    })
  );

  it.effect("counts only a pending invite", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, {
          invite: { at: 1, status: "revoked" },
        })
      );
      yield* fixture.run(
        invitePerson(fixture.tenants.other, address, {
          invite: { at: 1, status: "accepted", userId: account.userId },
        })
      );
      yield* fixture.run(claimAfterVerification(account.userId, address));
      expect(yield* fixture.run(claimJobs)).toEqual([]);
    })
  );

  it.effect("ignores an address in a form that no invite stores", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      yield* fixture.run(invitePerson(fixture.tenants.nf, address));
      yield* fixture.run(
        claimAfterVerification(account.userId, "Guru@Harapan.Example.Test")
      );
      expect(yield* fixture.run(claimJobs)).toEqual([]);
    })
  );
});

describe("tenancy/claims after an invite", () => {
  it.effect(
    "schedules the walk over the accounts that hold the address, and counts none of them itself",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.account("guru", address, true);
        yield* fixture.account("lain", other, true);
        yield* fixture.run(claimAfterInvite(address));
        expect(yield* fixture.run(jobsOf("tenancy/holders:schedule"))).toEqual([
          [{ cursor: null, email: address }],
        ]);
        expect(yield* fixture.run(claimJobs)).toEqual([]);
      })
  );
});
