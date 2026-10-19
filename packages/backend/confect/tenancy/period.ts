import type { TenantPeriodsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { DateTime, Option, Schema, Struct } from "effect";

/** A period's name, one line, as lists show it. */
export const PeriodName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/** A period is planned until it opens, active while it runs, and archived after it, and archived periods stay readable. */
export const PeriodStatus = Schema.Literals(["planned", "active", "archived"]);

/**
 * Reads a calendar date written `YYYY-MM-DD` on the clock of the unit's time
 * zone. `DateTime.make` reads such a date as midnight UTC, so the date is read as
 * midnight in the unit's zone instead, and formatted again: DateTime rolls an
 * impossible date such as 30 February forward, so only a date that formats back
 * to the same text is accepted. A calendar date the zone cannot place is
 * refused too.
 */
export const parseCivilDate = (value: string, timeZone: string) =>
  Option.filter(
    DateTime.makeZoned(`${value}T00:00:00`, {
      adjustForTimeZone: true,
      timeZone,
    }),
    (zoned) => DateTime.formatIsoDate(zoned) === value
  ).pipe(Option.map(() => value));

/**
 * A period of one unit. Its `start` and `end` are the calendar dates of the
 * unit's clock, and both are days the period covers. Stored dates sort in date
 * order as text, which the overlap check relies on.
 */
export const tenantPeriodValidator = Schema.Struct({
  end: Schema.String,
  name: PeriodName,
  start: Schema.String,
  status: PeriodStatus,
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});

/** One period as the wire shows it. */
export const periodView = (period: TenantPeriodsDoc) =>
  Struct.renameKeys(
    Struct.pick(period, ["_id", "end", "name", "start", "status"]),
    { _id: "id" }
  );
