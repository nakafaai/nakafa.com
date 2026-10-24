import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import type {
  ClassesDoc,
  TenantGrantsDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { CLASS_LIMIT, classView } from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { attendsUnit } from "@repo/backend/confect/classroom/student";
import {
  teachesUnit,
  teachingIn,
} from "@repo/backend/confect/classroom/teacher";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  Effect,
  HashMap,
  Option,
  Order,
  pipe,
  Tuple,
} from "effect";

/**
 * The active period of each active unit of the school. A unit holds at most one
 * active period, so each unit is one indexed read, and an archived unit or period is
 * left out. The units are bounded by UNIT_LIMIT.
 */
const activePeriodsOf = Effect.fn("classroom.classes.activePeriods")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const reader = yield* DatabaseReader;
  const units = yield* reader
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", tenantId).eq("status", "active")
    )
    .take(UNIT_LIMIT)
    .pipe(Effect.orDie);
  const periods = yield* Effect.forEach(units, (unit) =>
    reader
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", unit._id).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie)
  );
  return Arr.getSomes(periods);
});

/** The active classes of one cohort, at most CLASS_LIMIT of them. */
const activeIn = Effect.fnUntraced(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  return yield* (yield* DatabaseReader)
    .table("classes")
    .index("by_cohortId_and_status_and_nameKey", (query) =>
      query.eq("cohortId", cohortId).eq("status", "active")
    )
    .take(CLASS_LIMIT)
    .pipe(Effect.orDie);
});

/**
 * The classes one Person attends or teaches in one period, unordered. Its reads are
 * bounded: one placement, and the teaching rows of the period. An attended class
 * counts only while a student grant over its unit stands, the rule that
 * `classMember` decides by, and a taught class only while a teacher grant over its
 * unit stands, the rule that `subjectTeacher` decides by.
 */
const mineIn = Effect.fn("classroom.classes.mineIn")(function* (
  periodId: GenericId.GenericId<"tenantPeriods">,
  personId: GenericId.GenericId<"tenantPeople">,
  grants: readonly TenantGrantsDoc[]
) {
  const reader = yield* DatabaseReader;
  const placed = yield* Option.match(yield* placementOf(periodId, personId), {
    onNone: () => Effect.succeed(Arr.empty<ClassesDoc>()),
    onSome: (found) => activeIn(found.cohortId),
  });
  const taught = yield* Effect.forEach(
    yield* teachingIn(personId, periodId),
    (row) => reader.table("classes").get(row.classId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return [
    ...Arr.filter(placed, (row) => attendsUnit(grants, row.unitId)),
    ...Arr.filter(
      taught,
      (row) => row.status === "active" && teachesUnit(grants, row.unitId)
    ),
  ];
});

/**
 * The active classes the caller attends or teaches in the active period of each
 * active unit of the school, one entry per class, in the order of the sidebar: the
 * homeroom classes, which have no subject, first, then by name, then by address, so
 * the order is total.
 */
export const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("classroom.classes.mine")(function* () {
    const { grants, person, tenant } = yield* Member;
    const periods = yield* activePeriodsOf(tenant._id);
    const found = yield* Effect.forEach(
      periods,
      (period) => mineIn(period._id, person._id, grants),
      { concurrency: "unbounded" }
    );
    const byId = HashMap.fromIterable(
      Arr.map(Arr.flatten(found), (row) => Tuple.make(row._id, row))
    );
    return pipe(
      Arr.fromIterable(HashMap.values(byId)),
      Arr.sortBy(
        Order.mapInput(Order.Number, (row: ClassesDoc) =>
          row.subject === undefined ? 0 : 1
        ),
        Order.mapInput(Order.String, (row) => row.nameKey),
        Order.mapInput(Order.String, (row) => row._id)
      ),
      Arr.map(classView)
    );
  })
);
