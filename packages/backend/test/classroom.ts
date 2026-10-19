import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { slugOf, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

/** The school's address in every call of the classroom tests. */
export const nf = slugOf("nf");

/** The fixture `tenancyFixture` seeds, which the classroom tests extend. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/** The access refusal of one reason, as a client decodes it. */
export const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** The first page of a paginated list. */
export const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

const periods = refs.public.tenancy.periods;
const cohorts = refs.public.tenancy.cohorts;
const classes = refs.public.classroom.classes;
const teachers = refs.public.classroom.teachers;

/** Creates a planned period of one unit as the school's Admin. */
export const period = Effect.fn("test.classroom.period")(function* (
  fixture: Fixture,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return yield* fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId,
  });
});

/** Opens a planned period as the school's Admin, so its classes count as active. */
export const openPeriod = Effect.fn("test.classroom.openPeriod")(function* (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  return yield* fixture
    .as("admin")
    .mutation(periods.open, { periodId, slug: nf });
});

/**
 * Adds an SD unit to the school. The fixture seeds its SD unit in the other
 * school only, so a test that makes a homeroom class adds this one.
 */
export const sdUnit = Effect.fn("test.classroom.sdUnit")(function* (
  fixture: Fixture
) {
  return yield* fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantUnits").insert({
        contentLanguage: "id",
        level: "sd",
        name: "SD Nakafa",
        status: "active",
        tenantId: fixture.tenants.nf,
        timeZone: "Asia/Jakarta",
      })
    )
  );
});

/** Creates one cohort of a period as the school's Admin. */
export const cohort = Effect.fn("test.classroom.cohort")(function* (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) {
  return yield* fixture
    .as("admin")
    .mutation(cohorts.create, { grade: 10, name, periodId, slug: nf });
});

/**
 * Creates a class of a cohort as the Admin. A class of an SMP cohort names its
 * subject, and the homeroom class of an SD cohort takes none.
 */
export const classOf = Effect.fn("test.classroom.classOf")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  subject?: string
) {
  return yield* fixture.as("admin").mutation(classes.create, {
    cohortId,
    slug: nf,
    ...(subject === undefined ? {} : { subject }),
  });
});

/** Assigns one Person to teach a class as the Admin. */
export const teach = Effect.fn("test.classroom.teach")(function* (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* fixture.as("admin").mutation(teachers.assign, {
    classId,
    personId,
    slug: nf,
  });
});
