import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import {
  CLASS_LIMIT,
  classNameKey,
  classNameOf,
  classSlugOf,
  classSubjectKey,
  classView,
} from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import {
  ClassAddressEmpty,
  ClassLimit,
  ClassNameTaken,
  ClassSubjectNotAllowed,
  ClassSubjectRequired,
  ClassSubjectTaken,
} from "@repo/backend/confect/classroom/errors";
import { insertGeneral } from "@repo/backend/confect/classroom/forum/general";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect, Option } from "effect";

/** Whether another class of the period already uses this address. */
const addressTaken = Effect.fnUntraced(function* (
  periodId: GenericId.GenericId<"tenantPeriods">,
  slug: string
) {
  return yield* (yield* DatabaseReader)
    .table("classes")
    .index("by_periodId_and_slug", (query) =>
      query.eq("periodId", periodId).eq("slug", slug)
    )
    .first()
    .pipe(Effect.map(Option.isSome), Effect.orDie);
});

/**
 * The first address from the base that no class of the period holds: the base,
 * then the base with -2, -3, and so on. Each step is one indexed read, and the
 * walk ends at the first free address, so it visits only the taken ones.
 */
const freeAddress = (
  periodId: GenericId.GenericId<"tenantPeriods">,
  base: string,
  suffix: number
): Effect.Effect<string, never, DatabaseReader> => {
  const slug = suffix === 1 ? base : `${base}-${suffix}`;
  return Effect.flatMap(addressTaken(periodId, slug), (taken) =>
    taken ? freeAddress(periodId, base, suffix + 1) : Effect.succeed(slug)
  );
};

/**
 * Creates an active class of a cohort, named for its subject and its cohort. An
 * SD cohort holds only its homeroom class, which has no subject, and every other
 * cohort holds classes that name a subject. An active class of the cohort may not
 * have the same name or the same subject, and a cohort holds at most CLASS_LIMIT
 * classes, archived ones included. The address is the name's letters and digits,
 * unique within the period. The class's general channel is written in the same
 * transaction, so every class has one from its creation.
 */
export const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("classroom.classes.create")(function* ({ subject }) {
    const { person } = yield* Member;
    const cohort = yield* Cohort;
    const reader = yield* DatabaseReader;
    const unit = yield* reader
      .table("tenantUnits")
      .get(cohort.unitId)
      .pipe(Effect.orDie);
    const sd = unit.level === "sd";
    if (sd && subject !== undefined) {
      return yield* new ClassSubjectNotAllowed();
    }
    if (!sd && subject === undefined) {
      return yield* new ClassSubjectRequired();
    }
    const name = classNameOf(cohort.name, subject);
    const nameKey = classNameKey(name);
    const sameName = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_nameKey", (query) =>
        query
          .eq("cohortId", cohort._id)
          .eq("status", "active")
          .eq("nameKey", nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sameName)) {
      return yield* new ClassNameTaken();
    }
    const subjectKey = classSubjectKey(subject);
    const sameSubject = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_subjectKey", (query) =>
        query
          .eq("cohortId", cohort._id)
          .eq("status", "active")
          .eq("subjectKey", subjectKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sameSubject)) {
      return yield* new ClassSubjectTaken();
    }
    const cohortClasses = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_nameKey", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .take(CLASS_LIMIT)
      .pipe(Effect.orDie);
    if (cohortClasses.length >= CLASS_LIMIT) {
      return yield* new ClassLimit();
    }
    const base = classSlugOf(name);
    if (base === "") {
      return yield* new ClassAddressEmpty();
    }
    const slug = yield* freeAddress(cohort.periodId, base, 1);
    const now = yield* Clock.currentTimeMillis;
    const classId = yield* (yield* DatabaseWriter)
      .table("classes")
      .insert({
        cohortId: cohort._id,
        createdAt: now,
        name,
        nameKey,
        periodId: cohort.periodId,
        slug,
        status: "active",
        subjectKey,
        tenantId: cohort.tenantId,
        unitId: cohort.unitId,
        updatedAt: now,
        ...(subject === undefined ? {} : { subject }),
      })
      .pipe(Effect.orDie);
    yield* insertGeneral(classId, cohort.tenantId, now);
    const created = yield* reader
      .table("classes")
      .get(classId)
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), created, {
      type: "class.created",
    });
    return classView(created);
  })
);
