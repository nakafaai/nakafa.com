import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  ClassesDoc,
  ClassroomTasksDoc,
  TenantPeopleDoc,
  TenantsDoc,
} from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { mayIn, principalOf } from "@repo/backend/confect/classroom/roster";
import { guardiansOf } from "@repo/backend/confect/notifications/guardians";
import { queueMail } from "@repo/backend/confect/notifications/mail";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import spec from "@repo/backend/confect/notifications/tasks.spec";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/** Students one run reads, the batch of ADR 0027. */
const TASK_BATCH = 100;

/** Writes the deadline reminder of a task for one student, and schedules its push. */
const noticeStudent = Effect.fn("notifications.tasks.student")(function* (
  task: ClassroomTasksDoc,
  klass: ClassesDoc,
  tenant: TenantsDoc,
  student: TenantPeopleDoc,
  createdAt: number
) {
  const notificationId = yield* (yield* DatabaseWriter)
    .table("notifications")
    .insert({
      changeType: "assignment.deadline",
      createdAt,
      recipientPersonId: student._id,
      subject: { id: klass._id, kind: "class" },
      taskId: task._id,
      tenantId: task.tenantId,
    })
    .pipe(Effect.orDie);
  const principal = yield* principalOf(student, tenant);
  yield* schedulePush(
    "taskDeadline",
    notificationId,
    student,
    principal.grants,
    klass.unitId
  );
});

/** Writes the late-task notice for each guardian of a student, with its push and its mail. */
const noticeGuardians = Effect.fn("notifications.tasks.guardians")(function* (
  task: ClassroomTasksDoc,
  klass: ClassesDoc,
  tenant: TenantsDoc,
  student: TenantPeopleDoc,
  createdAt: number
) {
  const writer = yield* DatabaseWriter;
  const guardians = yield* guardiansOf(student._id);
  yield* Effect.forEach(
    guardians,
    (guardian) =>
      Effect.gen(function* () {
        const notificationId = yield* writer
          .table("notifications")
          .insert({
            changeType: "assignment.missed",
            createdAt,
            recipientPersonId: guardian._id,
            studentPersonId: student._id,
            subject: { id: klass._id, kind: "class" },
            taskId: task._id,
            tenantId: task.tenantId,
          })
          .pipe(Effect.orDie);
        const principal = yield* principalOf(guardian, tenant);
        yield* schedulePush(
          "taskMissed",
          notificationId,
          guardian,
          principal.grants,
          klass.unitId
        );
        yield* queueMail(
          "taskMissed",
          "guardian",
          guardian,
          klass.unitId,
          Option.none()
        );
      }),
    { discard: true }
  );
});

/**
 * Writes one page of a task's notice: each student of the class who reads it and has not handed in gets the reminder,
 * or each of their guardians gets the late-task notice. A task that is gone or a unit that is archived sends nothing,
 * and the next run reads the next page.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.tasks.run")(function* ({ cursor, notice, taskId }) {
    const reader = yield* DatabaseReader;
    const task = yield* reader
      .table("classroomTasks")
      .get(taskId)
      .pipe(Effect.option);
    if (Option.isNone(task)) {
      return null;
    }
    const klass = yield* reader
      .table("classes")
      .get(task.value.classId)
      .pipe(Effect.orDie);
    const unit = yield* reader
      .table("tenantUnits")
      .get(klass.unitId)
      .pipe(Effect.orDie);
    if (unit.status !== "active") {
      return null;
    }
    const tenant = yield* reader
      .table("tenants")
      .get(klass.tenantId)
      .pipe(Effect.orDie);
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", klass.cohortId)
      )
      .paginate({ cursor, numItems: TASK_BATCH })
      .pipe(Effect.orDie);
    const createdAt = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(
      Arr.dedupe(Arr.map(page.page, (row) => row.personId)),
      (personId) =>
        Effect.gen(function* () {
          const student = yield* reader
            .table("tenantPeople")
            .get(personId)
            .pipe(Effect.orDie);
          const principal = yield* principalOf(student, tenant);
          const reads =
            student.status === "active" &&
            (yield* mayIn("forum.read", klass, principal));
          const handedIn = yield* reader
            .table("classroomSubmissions")
            .index("by_taskId_and_personId", (query) =>
              query.eq("taskId", taskId).eq("personId", personId)
            )
            .first()
            .pipe(Effect.orDie);
          if (!reads || Option.isSome(handedIn)) {
            return;
          }
          yield* notice === "taskDeadline"
            ? noticeStudent(task.value, klass, tenant, student, createdAt)
            : noticeGuardians(task.value, klass, tenant, student, createdAt);
        }),
      { discard: true }
    );
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        notificationsInternal.tasks.run,
        { cursor: page.continueCursor, notice, taskId }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
