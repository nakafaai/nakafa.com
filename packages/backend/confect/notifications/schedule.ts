import type { GenericId } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { quietHoursEnd } from "@repo/backend/confect/notifications/clock";
import { namedTimeZone } from "@repo/utilities/timezone";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Option,
} from "effect";

/**
 * Schedules the push of one new inbox row (ADR 0027). A recipient without an
 * account, or whose account has no browser subscribed, gets none, so nothing is
 * scheduled for it. Quiet hours, 21:00 to 06:00 on the clock of the class's
 * unit, hold the push of a student until they end; the inbox row is there at
 * once either way. Every other recipient's push leaves at once.
 */
export const schedulePush = Effect.fn("notifications.schedule.push")(function* (
  notificationId: GenericId.GenericId<"notifications">,
  person: TenantPeopleDoc,
  grants: readonly TenantGrantsDoc[],
  unitId: GenericId.GenericId<"tenantUnits">
) {
  if (person.account.state !== "claimed") {
    return;
  }
  const reader = yield* DatabaseReader;
  const userId = person.account.userId;
  const subscribed = yield* reader
    .table("pushSubscriptions")
    .index("by_userId", (query) => query.eq("userId", userId))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(subscribed)) {
    return;
  }
  const scheduler = yield* Scheduler;
  const send = refs.internal.notifications.deliver.send;
  const student = Arr.some(grants, (grant) => grant.role.key === "student");
  const unit = yield* reader
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
  const zone = namedTimeZone(unit.timeZone);
  const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis);
  const held =
    student && Option.isSome(zone)
      ? quietHoursEnd(now, zone.value)
      : Option.none();
  if (Option.isSome(held)) {
    yield* scheduler.runAt(held.value, send, { notificationId });
    return;
  }
  yield* scheduler.runAfter(Duration.zero, send, { notificationId });
});
