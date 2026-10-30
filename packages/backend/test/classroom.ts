import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

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
const placements = refs.public.tenancy.placements;
const channels = refs.public.classroom.forum.channels;
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

/**
 * Writes one period, one cohort, and one class of a unit straight to the store, with
 * the statuses given, so a test holds a class in a state its mutations cannot reach.
 * It returns the class's id.
 */
export const writeClass = Effect.fn("test.classroom.writeClass")(function* (
  fixture: Fixture,
  unitId: GenericId.GenericId<"tenantUnits">,
  slug: string,
  periodStatus: "planned" | "active" | "archived",
  classStatus: "active" | "archived"
) {
  return yield* fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const periodId = yield* writer.table("tenantPeriods").insert({
        end: "2026-12-19",
        name: "Ganjil 2026/2027",
        start: "2026-07-13",
        status: periodStatus,
        tenantId: fixture.tenants.nf,
        unitId,
      });
      const cohortId = yield* writer.table("tenantCohorts").insert({
        grade: 10,
        name: "X-1",
        nameKey: "x-1",
        periodId,
        status: "active",
        tenantId: fixture.tenants.nf,
        unitId,
      });
      return yield* writer.table("classes").insert({
        cohortId,
        createdAt: 0,
        name: "Fisika X-1",
        nameKey: "fisika x-1",
        periodId,
        slug,
        status: classStatus,
        subject: "Fisika",
        subjectKey: "fisika",
        tenantId: fixture.tenants.nf,
        unitId,
        updatedAt: 0,
      });
    })
  );
});

/** The fixture of a forum test: a school with its people and the key that seals its forum, as provisioning writes it. */
export const keyedFixture = Effect.tap(tenancyFixture, (fixture) =>
  fixture.run(createTenantKey(fixture.tenants.nf))
);

/**
 * A class of a new cohort of one period with the fixture's teacher teaching it,
 * and the ID of its general channel. The fixture's student is placed in it unless
 * `placed` is false: a student has one cohort a period.
 */
export const forumClass = Effect.fn("test.classroom.forumClass")(function* (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  placed = true
) {
  const group = yield* cohort(fixture, periodId, name);
  const made = yield* classOf(fixture, group.id, "Fisika");
  yield* teach(fixture, made.id, fixture.people.teacher.personId);
  if (placed) {
    yield* fixture.as("admin").mutation(placements.place, {
      cohortId: group.id,
      personId: fixture.people.student.personId,
      slug: nf,
    });
  }
  const listed = yield* fixture
    .as("teacher")
    .query(channels.list, { ...firstPage, classId: made.id, slug: nf });
  const general = Option.getOrThrow(Arr.head(listed.page));
  return { channelId: general.id, classId: made.id };
});
