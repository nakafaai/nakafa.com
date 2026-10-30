import { FunctionImpl } from "@confect/server";
import type {
  TenantPeriodsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  PeriodDatesInvalid,
  PeriodOverlaps,
} from "@repo/backend/confect/tenancy/errors";
import {
  parseCivilDate,
  periodView,
} from "@repo/backend/confect/tenancy/period";
import spec from "@repo/backend/confect/tenancy/periods.spec";
import { Array as Arr, Effect, Option, Struct } from "effect";

/**
 * Checks two dates for a period of one school: both are calendar dates of the school's clock, the start is before the
 * end, and the span shares no day with another period of the school. `except` leaves out the period being edited, so
 * its own old dates never count against it.
 */
export const checkPeriodDates = Effect.fn("tenancy.periods.checkDates")(
  function* (
    unit: TenantUnitsDoc,
    start: string,
    end: string,
    except: Option.Option<TenantPeriodsDoc["_id"]>
  ) {
    if (
      Option.isNone(parseCivilDate(start, unit.timeZone)) ||
      Option.isNone(parseCivilDate(end, unit.timeZone)) ||
      start >= end
    ) {
      return yield* new PeriodDatesInvalid();
    }
    // The two periods that start last on or before `end` hold the only one that can overlap, once the edited period
    // is left out: periods of one school never overlap, so an earlier one ends before this one starts.
    const before = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index(
        "by_unitId_and_start",
        (query) => query.eq("unitId", unit._id).lte("start", end),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
    const other = Arr.findFirst(
      before,
      (found) => !Option.contains(except, found._id)
    );
    if (Option.exists(other, (found) => found.end >= start)) {
      return yield* new PeriodOverlaps();
    }
  }
);

/**
 * Edits one period in place: its name and its two dates, which follow the same rules as a new period's. An edit
 * journals what it changed, a new name as `period.rename` and new dates as `period.rescheduled`, and an edit that
 * changes nothing writes and journals nothing, so a screen that sends it twice is done the first time. An archived
 * period refuses the edit, as it refuses every other write.
 */
export const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("tenancy.periods.edit")(function* ({ end, name, start }) {
    const { person } = yield* Member;
    const period = yield* Period;
    const renamed = period.name !== name;
    const rescheduled = period.start !== start || period.end !== end;
    if (rescheduled) {
      const unit = yield* (yield* DatabaseReader)
        .table("tenantUnits")
        .get(period.unitId)
        .pipe(Effect.orDie);
      yield* checkPeriodDates(unit, start, end, Option.some(period._id));
    }
    if (!(renamed || rescheduled)) {
      return periodView(period);
    }
    const edited = Struct.assign(period, { end, name, start });
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(period._id, Struct.omit(edited, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    if (renamed) {
      yield* periodAuthority.record(personActor(person), period, {
        type: "period.rename",
      });
    }
    if (rescheduled) {
      yield* periodAuthority.record(personActor(person), period, {
        type: "period.rescheduled",
      });
    }
    return periodView(edited);
  })
);
