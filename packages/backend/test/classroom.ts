import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { slugOf, type tenancyFixture } from "@repo/backend/test/tenancy";
import type { Effect } from "effect";

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
export const period = (
  fixture: Fixture,
  unitId: GenericId.GenericId<"tenantUnits">
) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId,
  });

/** Creates one cohort of a period as the school's Admin. */
export const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) =>
  fixture
    .as("admin")
    .mutation(cohorts.create, { grade: 10, name, periodId, slug: nf });

/** Creates a class of a cohort as the Admin, named for its subject when it has one. */
export const classOf = (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  subject?: string
) =>
  fixture.as("admin").mutation(classes.create, {
    cohortId,
    slug: nf,
    ...(subject === undefined ? {} : { subject }),
  });

/** Assigns one Person to teach a class as the Admin. */
export const teach = (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.as("admin").mutation(teachers.assign, {
    classId,
    personId,
    slug: nf,
  });
