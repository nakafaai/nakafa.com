import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type {
  TenantCohortsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  requireAcceptanceSeed,
  SeedUnitMissing,
} from "@repo/backend/confect/acceptance/seed";
import { assignRole } from "@repo/backend/confect/access/grant";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import {
  type ClassSubject,
  classNameKey,
  classNameOf,
  classSlugOf,
  classSubjectKey,
} from "@repo/backend/confect/classroom/class";
import { freeAddress } from "@repo/backend/confect/classroom/classes/address";
import { insertGeneral } from "@repo/backend/confect/classroom/forum/general";
import spec from "@repo/backend/confect/classroom/seed.spec";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import {
  periodAuthority,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { writeInvite } from "@repo/backend/confect/tenancy/invite";
import type { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { insertCohort } from "@repo/backend/confect/tenancy/write/cohort";
import { Clock, Effect, Layer, Option } from "effect";

/** The cohort a seeded class belongs to, and the dates of the period a seed opens. Fixed, so every run reads the same. */
const SEED_COHORT = { grade: 10, name: "X-1" } as const;
const SEED_PERIOD = {
  end: "2026-12-19",
  name: "Ganjil 2026/2027",
  start: "2026-07-13",
} as const;

/**
 * The active period of a unit, or a new active one when the unit has none. A unit
 * holds at most one active period, so the first one found is the one.
 */
const activePeriodOf = Effect.fn("classroom.seed.activePeriod")(function* (
  unit: TenantUnitsDoc
) {
  const reader = yield* DatabaseReader;
  const active = yield* reader
    .table("tenantPeriods")
    .index("by_unitId_and_status", (query) =>
      query.eq("unitId", unit._id).eq("status", "active")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(active)) {
    return active.value;
  }
  const periodId = yield* (yield* DatabaseWriter)
    .table("tenantPeriods")
    .insert({
      ...SEED_PERIOD,
      status: "active",
      tenantId: unit.tenantId,
      unitId: unit._id,
    })
    .pipe(Effect.orDie);
  const opened = yield* reader
    .table("tenantPeriods")
    .get(periodId)
    .pipe(Effect.orDie);
  yield* periodAuthority.record(systemActor, opened, {
    type: "period.opened",
  });
  return opened;
});

/**
 * Writes one class of a cohort with its general channel, and journals it as
 * `classes.create` does, so a seeded class reads like a created one. Its address is
 * the one `classes.create` would give it, so it never shares a live address.
 */
const classOfCohort = Effect.fn("classroom.seed.class")(function* (
  cohort: TenantCohortsDoc,
  subject: typeof ClassSubject.Type
) {
  const reader = yield* DatabaseReader;
  const now = yield* Clock.currentTimeMillis;
  const name = classNameOf(cohort.name, subject);
  const slug = yield* freeAddress(cohort, classSlugOf(name)).pipe(Effect.orDie);
  const classId = yield* (yield* DatabaseWriter)
    .table("classes")
    .insert({
      cohortId: cohort._id,
      createdAt: now,
      name,
      nameKey: classNameKey(name),
      periodId: cohort.periodId,
      slug,
      status: "active",
      subject,
      subjectKey: classSubjectKey(subject),
      tenantId: cohort.tenantId,
      unitId: cohort.unitId,
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  yield* insertGeneral(classId, cohort.tenantId, now);
  const created = yield* reader
    .table("classes")
    .get(classId)
    .pipe(Effect.orDie);
  yield* classAuthority.record(systemActor, created, {
    type: "class.created",
  });
  return created;
});

/**
 * Writes an unclaimed Teacher with an invite to the address, and a teacher grant
 * over the whole school, as `tenancy/seed` writes its Teacher.
 */
const seededTeacher = Effect.fn("classroom.seed.teacherPerson")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  name: typeof PersonName.Type,
  email: typeof Email.Type,
  locale: typeof ActiveAppLocaleCodeSchema.Type
) {
  const personId = yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .insert({
      account: { state: "unclaimed" },
      kind: "member",
      name,
      status: "active",
      tenantId,
    })
    .pipe(Effect.orDie);
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  yield* personAuthority.record(systemActor, person, {
    type: "person.created",
  });
  const invite = yield* writeInvite(systemActor, person, email, locale);
  yield* assignRole(systemActor, person, "teacher", {
    kind: "tenant",
  }).pipe(Effect.orDie);
  return { invite, person };
});

/**
 * Seeds a class taught by one Teacher in the first active unit of an acceptance
 * school. The class sits in a new cohort of the unit's active period, and the
 * Teacher teaches it. The period is opened here, so the class is active.
 */
const teacher = FunctionImpl.make(
  databaseSchema,
  spec,
  "teacher",
  Effect.fn("classroom.seed.teacher")(function* ({
    email,
    locale,
    name,
    slug,
    subject,
  }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const unit = yield* reader
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant.value._id).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(unit)) {
      return yield* new SeedUnitMissing();
    }
    const period = yield* activePeriodOf(unit.value);
    const cohort = yield* insertCohort(systemActor, period, SEED_COHORT);
    const klass = yield* classOfCohort(cohort, subject);
    const seeded = yield* seededTeacher(tenant.value._id, name, email, locale);
    yield* (yield* DatabaseWriter)
      .table("classTeachers")
      .insert({
        classId: klass._id,
        createdAt: klass.createdAt,
        periodId: period._id,
        personId: seeded.person._id,
        tenantId: tenant.value._id,
      })
      .pipe(Effect.orDie);
    return {
      classId: klass._id,
      invite: seeded.invite._id,
      periodId: period._id,
      person: seeded.person._id,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(teacher),
  GroupImpl.finalize
);
