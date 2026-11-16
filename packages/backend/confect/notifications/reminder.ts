import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { scheduleAccountPush } from "@repo/backend/confect/notifications/schedule";
import {
  type ReminderRow,
  reminderView,
} from "@repo/backend/confect/notifications/schema";
import { Effect, Option, Struct } from "effect";

/**
 * Writes the inbox row of a try-out reminder, an hour before the learner's attempt ends, and schedules its push when
 * `push` says quiet hours let it leave now. Its email leaves on its own, six hours before the end (`tryouts/reminders`).
 */
export const noticeReminder = Effect.fn("notifications.reminder.write")(
  function* (
    attemptId: GenericId.GenericId<"tryoutAttempts">,
    recipientUserId: GenericId.GenericId<"users">,
    createdAt: number,
    push: boolean
  ) {
    const notificationId = yield* (yield* DatabaseWriter)
      .table("notifications")
      .insert({
        attemptId,
        changeType: "tryout.reminder",
        createdAt,
        recipientUserId,
      })
      .pipe(Effect.orDie);
    if (push) {
      yield* scheduleAccountPush(
        "tryoutReminder",
        notificationId,
        recipientUserId
      );
    }
  }
);

/** One reminder's row as the wire shows it, with the set its attempt names, or none once the attempt is gone. */
export const reminderNotice = Effect.fn("notifications.reminder.view")(
  function* (row: ReminderRow) {
    const attempt = yield* (yield* DatabaseReader)
      .table("tryoutAttempts")
      .get(row.attemptId)
      .pipe(Effect.option);
    return reminderView(
      row,
      Option.getOrNull(
        Option.map(attempt, (found) =>
          Struct.pick(found, ["countryKey", "examKey", "setKey", "trackKey"])
        )
      )
    );
  }
);
