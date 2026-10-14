import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeriodsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  periodAccess,
  periodAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PeriodActive,
  PeriodDatesInvalid,
  PeriodNotActive,
  PeriodOverlaps,
} from "@repo/backend/confect/tenancy/errors";
import {
  type PeriodStatus,
  parseCivilDate,
} from "@repo/backend/confect/tenancy/period";
import spec from "@repo/backend/confect/tenancy/periods.spec";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** One period as the wire shows it. */
const view = (period: TenantPeriodsDoc) =>
  Struct.renameKeys(
    Struct.pick(period, ["_id", "end", "name", "start", "status"]),
    { _id: "id" }
  );

/** Lists one school's periods, newest first. The roles that read the plan of a school read them. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.periods.list")(function* ({ paginationOpts, unitId }) {
    yield* unitAuthority.authorize("period.view", unitId);
    const page = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index(
        "by_unitId_and_start",
        (query) => query.eq("unitId", unitId),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, view) });
  })
);

/**
 * Creates a planned period in one school. Both dates are calendar dates of the
 * school's clock, the start is before the end, and the period shares no day with
 * another period of the school.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("tenancy.periods.create")(function* ({ end, name, start, unitId }) {
    const { person } = yield* Member;
    const unit = yield* unitAuthority.authorize("period.manage", unitId);
    if (
      Option.isNone(parseCivilDate(start, unit.timeZone)) ||
      Option.isNone(parseCivilDate(end, unit.timeZone)) ||
      start >= end
    ) {
      return yield* new PeriodDatesInvalid();
    }
    const reader = yield* DatabaseReader;
    const before = yield* reader
      .table("tenantPeriods")
      .index(
        "by_unitId_and_start",
        (query) => query.eq("unitId", unit._id).lte("start", end),
        "desc"
      )
      .first()
      .pipe(Effect.orDie);
    // The period that starts last on or before `end` is the only one that can
    // overlap: periods of one school never overlap, so an earlier one ends before
    // this one starts.
    if (Option.exists(before, (found) => found.end >= start)) {
      return yield* new PeriodOverlaps();
    }
    const periodId = yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .insert({
        end,
        name,
        start,
        status: "planned",
        tenantId: unit.tenantId,
        unitId: unit._id,
      })
      .pipe(Effect.orDie);
    const period = yield* reader
      .table("tenantPeriods")
      .get(periodId)
      .pipe(Effect.orDie);
    yield* periodAuthority.record(personActor(person), period, {
      type: "period.created",
    });
    return view(period);
  })
);

/**
 * Opens a planned period while no other period of its school is active. An
 * active period is already open, so opening it changes nothing.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("tenancy.periods.open")(function* () {
    const { person } = yield* Member;
    const period = yield* Period;
    if (period.status === "active") {
      return view(period);
    }
    const active = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", period.unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(active)) {
      return yield* new PeriodActive();
    }
    const status: typeof PeriodStatus.Type = "active";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* periodAuthority.record(personActor(person), period, {
      type: "period.opened",
    });
    return view(Struct.assign(period, { status }));
  })
);

/** Archives an active period, which then stays readable and refuses writes. Only an active period can be archived. */
const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("tenancy.periods.archive")(function* () {
    const { person } = yield* Member;
    const period = yield* Period;
    if (period.status !== "active") {
      return yield* new PeriodNotActive();
    }
    const status: typeof PeriodStatus.Type = "archived";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* periodAuthority.record(personActor(person), period, {
      type: "period.archived",
    });
    return view(Struct.assign(period, { status }));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(create),
  Layer.provide(open),
  Layer.provide(archive),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(periodAccess),
  GroupImpl.finalize
);
