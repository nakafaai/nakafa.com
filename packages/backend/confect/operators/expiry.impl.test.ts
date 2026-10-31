import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { operatorAccount } from "@repo/backend/test/operators";
import {
  actedAt,
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;
type Staff = Effect.Success<ReturnType<typeof operatorAccount>>;

const nf = slugOf("nf");
const HOUR_MS = 60 * 60 * 1000;
const requestVisit = refs.public.operators.visits.request;
const approve = refs.public.operators.visits.approve;
const endVisit = refs.public.operators.visits.end;
const sweep = refs.internal.operators.expiry.sweep;
const scheduledEnd = refs.internal.operators.expiry.visit;

/** Fake timers keep the scheduled ends from running until a test moves the clock. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

/** Requests a visit of `minutes` for the operator and approves it as the school's Admin. */
const approvedVisit = (fixture: Fixture, staff: Staff, minutes: number) =>
  Effect.gen(function* () {
    const visit = yield* staff.client.mutation(requestVisit, {
      minutes,
      note: "Jadwal",
      reason: "support",
      tenantId: fixture.tenants.nf,
    });
    return yield* fixture.as("admin").mutation(approve, {
      slug: nf,
      visitId: visit.id,
    });
  });

describe("operators/expiry visit", () => {
  it.effect(
    "ends an approved visit at its term though the operator never left, and journals the expiry as the system",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "expires");
        const visit = yield* approvedVisit(fixture, staff, 60);
        vi.setSystemTime(TENANCY_NOW + HOUR_MS);
        yield* fixture.finishScheduled();
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantVisits").get(visit.id)
          )
        );
        // The clock of a fake-timer run moves past the term, so only the outcome is fixed.
        expect(stored.state).toMatchObject({
          reason: "expired",
          status: "ended",
        });
        expect(Arr.takeRight(yield* fixture.run(journal), 3)).toMatchObject([
          {
            actor: { kind: "system" },
            change: { reason: "expired", type: "grant.ended" },
          },
          {
            actor: { kind: "system" },
            change: { type: "person.suspended" },
          },
          {
            actor: { kind: "system" },
            change: { reason: "expired", type: "visit.ended" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
      })
  );

  it.effect(
    "does nothing at its term when the operator already left the visit by hand",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "leaves-first");
        const visit = yield* approvedVisit(fixture, staff, 60);
        yield* staff.client.mutation(endVisit, { slug: nf, visitId: visit.id });
        const before = yield* fixture.run(journal);
        vi.setSystemTime(TENANCY_NOW + HOUR_MS);
        // The scheduler swallows a failed job, so the body runs directly and a failure fails the test.
        yield* fixture.internal.mutation(scheduledEnd, { visitId: visit.id });
        expect(yield* fixture.run(journal)).toEqual(before);
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantVisits").get(visit.id)
          )
        );
        expect(stored.state).toMatchObject({ reason: "left", status: "ended" });
      })
  );
});

describe("operators/expiry sweep", () => {
  it.effect(
    "ends a visit whose term has passed, though its own scheduled end never ran",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "swept");
        vi.setSystemTime(actedAt());
        const visit = yield* approvedVisit(fixture, staff, 60);
        vi.setSystemTime(actedAt() + HOUR_MS);
        yield* fixture.internal.mutation(sweep, {});
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantVisits").get(visit.id)
          )
        );
        expect(stored.state).toEqual({
          at: actedAt() + HOUR_MS,
          reason: "expired",
          status: "ended",
        });
      })
  );

  it.effect(
    "leaves a visit whose term has not passed, and a request nobody has answered",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "running");
        const waiting = yield* operatorAccount(fixture, "waits");
        const visit = yield* approvedVisit(fixture, staff, 60);
        const request = yield* waiting.client.mutation(requestVisit, {
          minutes: 60,
          note: "Menunggu",
          reason: "incident",
          tenantId: fixture.tenants.nf,
        });
        vi.setSystemTime(TENANCY_NOW + HOUR_MS - 1);
        yield* fixture.internal.mutation(sweep, {});
        const read = (id: typeof visit.id) =>
          fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader.table("tenantVisits").get(id)
            )
          );
        expect((yield* read(visit.id)).state.status).toBe("approved");
        expect((yield* read(request.id)).state.status).toBe("pending");
      })
  );
});
