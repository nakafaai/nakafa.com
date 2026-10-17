import { Id } from "@repo/backend/confect/_generated/id";
import { TimeZone } from "@repo/backend/confect/tenancy/locale";
import { UnitStatus } from "@repo/backend/confect/tenancy/schema";
import { namedTimeZone } from "@repo/utilities/timezone";
import { Array as Arr, Effect, Option, Order, Schema } from "effect";

/**
 * A unit as the zone rule reads it: its id, the moment it was created, its
 * status, and its time zone. The caller reads the units of the tenant and
 * passes them in, so this rule does no database work.
 */
export const UnitZone = Schema.Struct({
  _creationTime: Schema.Finite,
  _id: Id("tenantUnits"),
  status: UnitStatus,
  timeZone: TimeZone,
});

type UnitZone = typeof UnitZone.Type;

/**
 * The zone of a notice cannot be read: its unit is not among the units given
 * (`UNIT_NOT_FOUND`), the tenant has no active unit to take the zone from
 * (`NO_ACTIVE_UNIT`), or the stored zone of the unit is not an IANA zone
 * (`ZONE_INVALID`).
 */
class NoticeZoneUnresolved extends Schema.TaggedError<NoticeZoneUnresolved>()(
  "NoticeZoneUnresolved",
  {
    reason: Schema.Literals([
      "UNIT_NOT_FOUND",
      "NO_ACTIVE_UNIT",
      "ZONE_INVALID",
    ]),
  }
) {}

/**
 * Units by the moment they were created, and then by their id. The id breaks a
 * tie, so two units created in one moment never depend on the order of the list.
 */
const byCreationThenId = Order.combine(
  Order.mapInput(Order.Number, (unit: UnitZone) => unit._creationTime),
  Order.mapInput(Order.String, (unit: UnitZone) => unit._id)
);

/** The active unit that was created first, whatever order the units are listed in. */
const oldestActiveUnit = (
  units: readonly UnitZone[]
): Option.Option<UnitZone> =>
  Arr.head(
    Arr.sort(byCreationThenId)(
      Arr.filter(units, (unit) => unit.status === "active")
    )
  );

/**
 * The unit that carries a notice: its own unit, or for a tenant-level notice
 * such as an invitation, the oldest active unit of the tenant.
 */
const unitOf = (
  unitId: Option.Option<UnitZone["_id"]>,
  units: readonly UnitZone[]
): Effect.Effect<UnitZone, NoticeZoneUnresolved> => {
  if (Option.isNone(unitId)) {
    return Effect.fromOption(oldestActiveUnit(units)).pipe(
      Effect.mapError(
        () => new NoticeZoneUnresolved({ reason: "NO_ACTIVE_UNIT" })
      )
    );
  }
  return Effect.fromOption(
    Arr.findFirst(units, (unit) => unit._id === unitId.value)
  ).pipe(
    Effect.mapError(
      () => new NoticeZoneUnresolved({ reason: "UNIT_NOT_FOUND" })
    )
  );
};

/**
 * The time zone that carries a notice (ADR 0027): the zone of the unit its
 * object belongs to, or the zone of the tenant's oldest active unit for a
 * tenant-level object. Quiet hours, reminders, and digests read their clock in
 * this zone. A zone that cannot be read fails with `NoticeZoneUnresolved`, so no
 * notice is scheduled on a guessed zone.
 */
export const zoneOfNotice = Effect.fn("notifications.zone.of")(function* (
  unitId: Option.Option<UnitZone["_id"]>,
  units: readonly UnitZone[]
) {
  const unit = yield* unitOf(unitId, units);
  return yield* Effect.fromOption(namedTimeZone(unit.timeZone)).pipe(
    Effect.mapError(() => new NoticeZoneUnresolved({ reason: "ZONE_INVALID" }))
  );
});
