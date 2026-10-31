import type { GenericId } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
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

/** The zone of an account's notices: an account keeps none, and Nakafa's learners are in Indonesia. */
const ACCOUNT_TIME_ZONE = "Asia/Jakarta";

/**
 * Schedules the send of one row's push: at the end of quiet hours on the clock of
 * `timeZone` for a student inside them, and at once for everyone else.
 */
const scheduleSend = Effect.fn("notifications.schedule.send")(function* (
  notificationId: GenericId.GenericId<"notifications">,
  student: boolean,
  timeZone: string
) {
  const scheduler = yield* Scheduler;
  const send = notificationsInternal.deliver.send;
  const zone = namedTimeZone(timeZone);
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

/** The first browser that an account subscribed, if any did. */
const firstSubscription = Effect.fn("notifications.schedule.subscribed")(
  function* (userId: GenericId.GenericId<"users">) {
    return yield* (yield* DatabaseReader)
      .table("pushSubscriptions")
      .index("by_userId", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.orDie);
  }
);

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
  if (Option.isNone(yield* firstSubscription(person.account.userId))) {
    return;
  }
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
  yield* scheduleSend(
    notificationId,
    Arr.some(grants, (grant) => grant.role.key === "student"),
    unit.timeZone
  );
});

/**
 * Schedules the push of one new row of an account, which no school holds. An
 * account with no browser subscribed gets none. A student's quiet hours run on the
 * clock of Indonesia, because an account keeps no zone of its own.
 */
export const scheduleAccountPush = Effect.fn(
  "notifications.schedule.accountPush"
)(function* (
  notificationId: GenericId.GenericId<"notifications">,
  userId: GenericId.GenericId<"users">
) {
  if (Option.isNone(yield* firstSubscription(userId))) {
    return;
  }
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(Effect.orDie);
  yield* scheduleSend(
    notificationId,
    user.role === "student",
    ACCOUNT_TIME_ZONE
  );
});
