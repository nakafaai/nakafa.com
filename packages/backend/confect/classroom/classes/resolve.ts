import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { classView } from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The active period of each active unit of the school. A unit holds at most one
 * active period, because opening a period refuses while another period of its unit
 * is active, so one read per unit finds every active period. The units are read up
 * to UNIT_LIMIT, the most units a school may hold.
 */
const activePeriodsOf = Effect.fnUntraced(function* (
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
  const periods = yield* Effect.forEach(
    units,
    (unit) =>
      reader
        .table("tenantPeriods")
        .index("by_unitId_and_status", (query) =>
          query.eq("unitId", unit._id).eq("status", "active")
        )
        .first()
        .pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(periods);
});

/**
 * The active class of one period that holds the address, if any. `create` walks
 * past every address that a class of the period holds, archived classes included,
 * so one period holds at most one class at each address and one read finds it.
 * An archived class holds no address for resolution, so it is left out here.
 */
const holderIn = Effect.fnUntraced(function* (
  periodId: GenericId.GenericId<"tenantPeriods">,
  classSlug: string
) {
  const found = yield* (yield* DatabaseReader)
    .table("classes")
    .index("by_periodId_and_slug", (query) =>
      query.eq("periodId", periodId).eq("slug", classSlug)
    )
    .first()
    .pipe(Effect.orDie);
  return Option.filter(found, (row) => row.status === "active");
});

/**
 * One active class by its address in the caller's school. It reads the active
 * periods of the active units only, so a class in an archived period never
 * resolves. An archived class holds no address, so it never resolves either, and
 * it stays readable by its ID. An address that no active class holds is refused
 * the way a missing object is, and one that two or more active classes hold is
 * refused as ambiguous. The ambiguity refusal comes before the access decision and
 * names no class. The one class found is decided on as `class.view`.
 */
export const resolve = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolve",
  Effect.fn("classroom.classes.resolve")(function* ({ classSlug }) {
    const { tenant } = yield* Member;
    const periods = yield* activePeriodsOf(tenant._id);
    const holders = Arr.getSomes(
      yield* Effect.forEach(
        periods,
        (period) => holderIn(period._id, classSlug),
        { concurrency: "unbounded" }
      )
    );
    if (holders.length > 1) {
      return yield* new ClassAmbiguous();
    }
    const found = Arr.head(holders);
    if (Option.isNone(found)) {
      return yield* new AccessDenied({
        action: "class.view",
        reason: "resource",
      });
    }
    yield* classAuthority.check("class.view", found.value);
    return classView(found.value);
  })
);
