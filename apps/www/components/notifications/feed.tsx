"use client";

import { DateTime } from "effect";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsList } from "@/components/notifications/list";
import { useAgeClock } from "@/components/user/clock.client";

/**
 * The inbox of the signed-in account. Every age in it counts from one clock, which a
 * timer moves forward each minute, and each row reads that clock.
 */
export function NotificationsFeed() {
  const clock = useAgeClock(DateTime.toEpochMillis(DateTime.nowUnsafe()));

  return (
    <NotificationsClockContext value={clock}>
      <NotificationsList />
    </NotificationsClockContext>
  );
}
