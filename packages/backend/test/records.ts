import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import { nf } from "@repo/backend/test/classroom";
import { NISN } from "@repo/backend/test/guardians";
import { grantRole, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

/** The fixture `tenancyFixture` seeds, which the records tests extend. */
type Fixture = Effect.Success<typeof tenancyFixture>;

const reports = refs.public.records.reports;
const grades = refs.public.records.grades;

/** Creates a class group of one grade in a period as the Admin. */
export const cohortOf = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  grade: number
) =>
  fixture.as("admin").mutation(refs.public.tenancy.cohorts.create, {
    grade,
    name,
    periodId,
    slug: nf,
  });

/** The teacher enters and releases one grade of the student in a class. */
export const release = Effect.fn("test.records.release")(function* (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">,
  value: number
) {
  const grade = yield* fixture.as("teacher").mutation(grades.enter, {
    classId,
    personId: fixture.people.student.personId,
    slug: nf,
    value,
  });
  yield* fixture
    .as("teacher")
    .mutation(grades.release, { gradeId: grade.id, slug: nf });
});

/**
 * Places the student in a class group with the teacher as its homeroom teacher, and gives the
 * principal the class group's unit, so the report cards go through the whole flow.
 */
export const staff = Effect.fn("test.records.staff")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  yield* fixture.as("admin").mutation(refs.public.tenancy.placements.place, {
    cohortId,
    personId: fixture.people.student.personId,
    slug: nf,
  });
  yield* fixture.as("admin").mutation(refs.public.tenancy.assignments.assign, {
    cohortId,
    personId: fixture.people.teacher.personId,
    slug: nf,
  });
  yield* fixture.run(
    grantRole(
      fixture.tenants.nf,
      fixture.people.principal.personId,
      "principal",
      {
        kind: "unit",
        unitId,
      }
    )
  );
});

/** The homeroom teacher writes and hands in the student's report, and the principal approves it, which locks it. */
export const lockReport = Effect.fn("test.records.lockReport")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const draft = yield* fixture.as("teacher").mutation(reports.write, {
    cohortId,
    note: "Rajin.",
    personId: fixture.people.student.personId,
    slug: nf,
  });
  yield* fixture
    .as("teacher")
    .mutation(reports.complete, { reportId: draft.id, slug: nf });
  yield* fixture
    .as("principal")
    .mutation(reports.approve, { reportId: draft.id, slug: nf });
  yield* fixture.finishScheduled();
});

/** Gives the SMP unit its NPSN and the student a NISN. */
export const complete = Effect.fn("test.records.complete")(function* (
  fixture: Fixture
) {
  yield* fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantUnits").patch(fixture.units.smp, {
        npsn: Schema.decodeSync(Npsn)("20212345"),
      })
    ).pipe(Effect.orDie)
  );
  yield* fixture.as("admin").mutation(refs.public.roster.entries.set, {
    nisn: NISN,
    personId: fixture.people.student.personId,
    slug: nf,
  });
});
