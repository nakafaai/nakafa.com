import type {
  ClassesDoc,
  ClassroomTasksDoc,
} from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import {
  deliveriesOf,
  deliveryInstant,
} from "@repo/backend/confect/notifications/delivery";
import { Array as Arr, Clock, DateTime, Effect, Result } from "effect";

/**
 * Schedules the runs of a task's notices: the reminders the rules give a student for each inbox send, counted from the
 * deadline on the clock of the class's unit, and the late-task run at the deadline itself (ADR 0027). A reminder whose
 * time has passed runs at once, and two that have passed run once, so a task published close to its deadline sends one.
 * A deadline already past sends nothing. Answers the scheduled jobs, which the task keeps, so moving the deadline
 * cancels the runs that have not started.
 */
export const scheduleTaskNotices = Effect.fn("notifications.tasks.schedule")(
  function* (
    task: Pick<ClassroomTasksDoc, "_id" | "deadline">,
    unitId: ClassesDoc["unitId"]
  ) {
    const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis);
    const deadline = DateTime.makeUnsafe(task.deadline);
    if (DateTime.isLessThanOrEqualTo(deadline, now)) {
      return [];
    }
    const unit = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .get(unitId)
      .pipe(Effect.orDie);
    // A unit's time zone is checked as an IANA zone where it is written, so one that does not read is a defect.
    const zone = yield* DateTime.zoneMakeNamedEffect(unit.timeZone).pipe(
      Effect.orDie
    );
    const reminders = Arr.filterMap(
      deliveriesOf("taskDeadline", "student", false),
      (delivery) =>
        delivery.channel === "inbox"
          ? Result.succeed(deliveryInstant(deadline, delivery.timing, zone))
          : Result.failVoid
    );
    const ahead = Arr.filter(reminders, (at) =>
      DateTime.isGreaterThan(at, now)
    );
    const runs = [
      ...Arr.map(
        ahead.length === reminders.length ? ahead : Arr.prepend(ahead, now),
        (at) => ({ at, notice: "taskDeadline" as const })
      ),
      { at: deadline, notice: "taskMissed" as const },
    ];
    const scheduler = yield* Scheduler;
    return yield* Effect.forEach(runs, ({ at, notice }) =>
      scheduler.runAt(at, notificationsInternal.tasks.run, {
        cursor: null,
        notice,
        taskId: task._id,
      })
    );
  }
);

/** Replaces the pending runs of a task whose deadline moved, and answers the new jobs. */
export const moveTaskNotices = Effect.fn("notifications.tasks.move")(function* (
  task: Pick<ClassroomTasksDoc, "_id" | "deadline" | "jobs">,
  unitId: ClassesDoc["unitId"]
) {
  yield* Effect.forEach(task.jobs ?? [], cancelPending, { discard: true });
  return yield* scheduleTaskNotices(task, unitId);
});
