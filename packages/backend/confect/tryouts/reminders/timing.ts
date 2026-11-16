import type { GenericId } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  ACCOUNT_TIME_ZONE,
  quietHoursEnd,
  REMINDER_QUIET_END,
} from "@repo/backend/confect/notifications/clock";
import { TRYOUT_REMINDER_LEADS } from "@repo/backend/confect/notifications/rules";
import type {
  ReminderJob,
  ReminderTime,
} from "@repo/backend/confect/tryouts/reminders/schema";
import { namedTimeZone } from "@repo/utilities/timezone";
import { Array as Arr, DateTime, Duration, Effect, Option } from "effect";

/** How long a learner must be idle before the six-hour email is worth sending. */
export const REMINDER_IDLE = Duration.hours(1);

/**
 * Schedules a new attempt's reminders: the email six hours before it ends and the push and inbox row one hour
 * before (`TRYOUT_REMINDER_LEADS`). An attempt stays open far longer than either lead (`TRYOUT_ATTEMPT_WINDOW`), so
 * both lie ahead of its start. Each job does nothing unless the attempt still runs to the same end
 * (`runningAttempt`), so finishing cancels them.
 */
export const scheduleReminders = Effect.fn("tryouts.reminders.schedule")(
  function* (job: typeof ReminderJob.Type) {
    const scheduler = yield* Scheduler;
    const reminders = [
      [TRYOUT_REMINDER_LEADS.email, tryoutsInternal.reminders.jobs.email],
      [TRYOUT_REMINDER_LEADS.hour, tryoutsInternal.reminders.jobs.hour],
    ] as const;
    yield* Effect.forEach(
      reminders,
      ([lead, ref]) =>
        scheduler.runAt(
          DateTime.makeUnsafe(job.expiresAt - Duration.toMillis(lead)),
          ref,
          job
        ),
      { discard: true }
    );
  }
);

/** The attempt a job reminds of, while it still runs to the end the job was scheduled for. */
export const runningAttempt = Effect.fn("tryouts.reminders.running")(function* (
  job: Pick<typeof ReminderJob.Type, "attemptId" | "expiresAt">
) {
  const attempt = yield* (yield* DatabaseReader)
    .table("tryoutAttempts")
    .get(job.attemptId)
    .pipe(Effect.option);
  return Option.filter(
    attempt,
    (found) =>
      found.status === "in-progress" && found.expiresAt === job.expiresAt
  );
});

/** The last moment the learner worked on the attempt: its start, or their latest answer in any section. */
export const lastActivityOf = Effect.fn("tryouts.reminders.lastActivity")(
  function* (attempt: Docs["tryoutAttempts"]) {
    const sections = yield* (yield* DatabaseReader)
      .table("tryoutSectionAttempts")
      .index("by_tryoutAttemptId_and_sectionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.sections.length)
      .pipe(Effect.orDie);
    return Arr.reduce(sections, attempt.lastActivityAt, (latest, section) =>
      Math.max(latest, section.lastActivityAt)
    );
  }
);

/**
 * When a reminder sent at `now` may leave: now, outside quiet hours (21:00 to 07:00 in Indonesia, decision D4); at
 * their end, when that is still before `latest`; or never, when quiet hours would hold it past `latest`.
 */
export const reminderTime = (
  now: number,
  latest: number
): typeof ReminderTime.Type =>
  Option.match(
    Option.flatMap(namedTimeZone(ACCOUNT_TIME_ZONE), (zone) =>
      quietHoursEnd(DateTime.makeUnsafe(now), zone, REMINDER_QUIET_END)
    ),
    {
      onNone: () => ({ _tag: "Now" }),
      onSome: (end) => {
        const at = DateTime.toEpochMillis(end);
        return at < latest ? { _tag: "At", at } : { _tag: "Never" };
      },
    }
  );

/** The wording a reminder is tried in: half the attempts read one, half the other, by the attempt's ID. */
export const variantOf = (
  attemptId: GenericId.GenericId<"tryoutAttempts">
): "a" | "b" =>
  Arr.reduce(
    Arr.fromIterable(attemptId),
    0,
    (sum, char) => sum + char.charCodeAt(0)
  ) %
    2 ===
  0
    ? "a"
    : "b";

/** The whole hours left before an attempt ends, at least one. */
export const hoursLeft = (expiresAt: number, now: number) =>
  Math.max(
    1,
    Math.floor((expiresAt - now) / Duration.toMillis(Duration.hours(1)))
  );
