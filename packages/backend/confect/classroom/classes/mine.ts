import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { CLASS_LIMIT, classView } from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { teachingIn } from "@repo/backend/confect/classroom/teacher";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, HashMap, Option, Order, Tuple } from "effect";

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
 * The active classes the caller teaches and attends in one period, by name. A
 * period is read only when it belongs to the caller's school, and the reads are
 * bounded: one placement, and the teaching rows of that period.
 */
export const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("classroom.classes.mine")(function* ({ periodId }) {
    const { person, tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const period = yield* reader
      .table("tenantPeriods")
      .get(periodId)
      .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
    if (Option.isNone(period) || period.value.tenantId !== tenant._id) {
      return yield* new AccessDenied({
        action: "class.mine",
        reason: "resource",
      });
    }
    const placed = yield* Option.match(
      yield* placementOf(periodId, person._id),
      {
        onNone: () => Effect.succeed(Arr.empty<ClassesDoc>()),
        onSome: (found) => activeIn(found.cohortId),
      }
    );
    const taught = yield* Effect.forEach(
      yield* teachingIn(person._id, periodId),
      (row) => reader.table("classes").get(row.classId).pipe(Effect.orDie),
      { concurrency: "unbounded" }
    );
    const byId = HashMap.fromIterable(
      Arr.map(
        [...placed, ...Arr.filter(taught, (row) => row.status === "active")],
        (row) => Tuple.make(row._id, row)
      )
    );
    return Arr.map(
      Arr.sortWith(
        Arr.fromIterable(HashMap.values(byId)),
        (row) => row.nameKey,
        Order.String
      ),
      classView
    );
  })
);
