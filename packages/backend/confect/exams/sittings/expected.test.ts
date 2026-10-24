import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
  seedAttempt,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { expected } = refs.public.exams.sittings;
const page = { cursor: null, numItems: 100 };

describe("exams/sittings expected", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lists the students a unit sitting expects, and drops each one who has an attempt in it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGrants").insert({
              grantedBy: { kind: "system" },
              personId: fixture.invited,
              role: { key: "student", kind: "builtin" },
              scope: { kind: "unit", unitId: fixture.units.sma },
              status: "active",
              tenantId: fixture.tenants.nf,
              term: { kind: "standing" },
            })
          )
        );
        const before = yield* fixture.as("teacher").query(expected, {
          paginationOpts: page,
          sittingId: made.id,
          slug: nf,
        });
        const names = Arr.map(before.page, (seat) => seat.id);
        expect(names).toContain(fixture.people.student.personId);
        expect(names).not.toContain(fixture.people.teacher.personId);
        expect(names).not.toContain(fixture.invited);
        yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.people.student.personId,
          sittingId: made.id,
          state: "inProgress",
        });
        const after = yield* fixture.as("teacher").query(expected, {
          paginationOpts: page,
          sittingId: made.id,
          slug: nf,
        });
        expect(Arr.map(after.page, (seat) => seat.id)).not.toContain(
          fixture.people.student.personId
        );
      })
  );

  it.effect(
    "lists only the students placed in a cohort sitting, each with the name the seat shows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Kelas");
        const cohortId = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            });
            const cohort = yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10A",
              nameKey: "10a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            });
            yield* writer.table("tenantCohortMembers").insert({
              cohortId: cohort,
              periodId,
              personId: fixture.people.student.personId,
              tenantId: fixture.tenants.nf,
            });
            return cohort;
          })
        );
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS_AT,
        });
        const seats = yield* fixture.as("teacher").query(expected, {
          paginationOpts: page,
          sittingId: made.id,
          slug: nf,
        });
        expect(seats.page).toMatchObject([
          {
            id: fixture.people.student.personId,
            name: expect.any(String),
          },
        ]);
        expect(seats.page).toHaveLength(1);
      })
  );

  it.effect(
    "expects no seat for a student whose Person is no longer an active member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Dicabut");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeople")
              .patch(fixture.people.student.personId, { status: "suspended" })
          )
        );
        const seats = yield* fixture.as("teacher").query(expected, {
          paginationOpts: page,
          sittingId: made.id,
          slug: nf,
        });
        expect(Arr.map(seats.page, (seat) => seat.id)).not.toContain(
          fixture.people.student.personId
        );
      })
  );
});
