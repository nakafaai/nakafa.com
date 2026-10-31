import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { asStaffSchool, NISN } from "@repo/backend/test/guardians";
import {
  cohortOf,
  complete,
  lockReport,
  release,
  staff,
} from "@repo/backend/test/records";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const ledger = refs.public.records.exports.ledger;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("records/exports", () => {
  it.effect(
    "gives each student's NISN and the grades of their locked report for Dapodik, and none before the lock",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const viii = yield* cohortOf(fixture, term.id, "VIII-A", 8);
        yield* staff(fixture, viii.id, fixture.units.smp);
        const fisika = yield* classOf(fixture, viii.id, "Fisika");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        yield* release(fixture, fisika.id, 82);
        const args = { ...firstPage, cohortId: viii.id, slug: nf };
        expect(
          (yield* fixture.as("counselor").query(ledger, args)).page
        ).toEqual([{ name: "Student", nisn: null, subjects: null }]);
        yield* complete(fixture);
        yield* lockReport(fixture, viii.id);
        expect((yield* fixture.as("admin").query(ledger, args)).page).toEqual([
          {
            name: "Student",
            nisn: NISN,
            subjects: [
              {
                className: "Fisika VIII-A",
                kktp: "reached",
                subject: "Fisika",
                value: 82,
              },
            ],
          },
        ]);
        expect(
          yield* Effect.flip(fixture.as("teacher").query(ledger, args))
        ).toMatchObject(denied("role"));
      })
  );
});
