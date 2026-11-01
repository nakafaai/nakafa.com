import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  ExamSittingsDoc,
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
import { principalOf } from "@repo/backend/confect/classroom/roster";
import { expectedSeats } from "@repo/backend/confect/exams/sittings/expected";
import { guardiansOf } from "@repo/backend/confect/notifications/guardians";
import { queueMail } from "@repo/backend/confect/notifications/mail";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import spec from "@repo/backend/confect/notifications/sittings.spec";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** Students one run reads, the batch of ADR 0027. */
const SITTING_BATCH = 100;

/** Writes the start notice of a sitting for one student it expects, and schedules its push and its mail. */
const noticeStudent = Effect.fn("notifications.sittings.student")(function* (
  sitting: ExamSittingsDoc,
  tenant: TenantsDoc,
  student: TenantPeopleDoc,
  createdAt: number
) {
  const notificationId = yield* (yield* DatabaseWriter)
    .table("notifications")
    .insert({
      changeType: "exam.starting",
      createdAt,
      recipientPersonId: student._id,
      sittingId: sitting._id,
      subject: { id: sitting._id, kind: "sitting" },
      tenantId: sitting.tenantId,
    })
    .pipe(Effect.orDie);
  const principal = yield* principalOf(student, tenant);
  yield* schedulePush(
    "examStart",
    notificationId,
    student,
    principal.grants,
    sitting.unitId
  );
  yield* queueMail(
    "examStart",
    "student",
    student,
    sitting.unitId,
    Option.some(sitting.opensAt)
  );
});

/** Writes the reminder of a sitting, with its mail, for each active guardian with a verified link to one student it expects. */
const noticeGuardians = Effect.fn("notifications.sittings.guardians")(
  function* (
    sitting: ExamSittingsDoc,
    student: TenantPeopleDoc,
    createdAt: number
  ) {
    const writer = yield* DatabaseWriter;
    const guardians = yield* guardiansOf(student._id);
    yield* Effect.forEach(
      guardians,
      (guardian) =>
        Effect.gen(function* () {
          yield* writer.table("notifications").insert({
            changeType: "exam.reminder",
            createdAt,
            recipientPersonId: guardian._id,
            sittingId: sitting._id,
            studentPersonId: student._id,
            subject: { id: sitting._id, kind: "sitting" },
            tenantId: sitting.tenantId,
          });
          yield* queueMail(
            "examGuardianReminder",
            "guardian",
            guardian,
            sitting.unitId,
            Option.some(sitting.opensAt)
          );
        }).pipe(Effect.orDie),
      { discard: true }
    );
  }
);

/**
 * Writes one page of a sitting's notice: each student the sitting expects gets the start notice with its push, or each
 * of their guardians gets the reminder. A sitting that has opened, closed, or was cancelled sends nothing, and the next
 * run reads the next page.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.sittings.run")(function* ({
    cursor,
    notice,
    sittingId,
  }) {
    const reader = yield* DatabaseReader;
    const sitting = yield* reader
      .table("examSittings")
      .get(sittingId)
      .pipe(Effect.option);
    if (Option.isNone(sitting) || sitting.value.state !== "scheduled") {
      return null;
    }
    const tenant = yield* reader
      .table("tenants")
      .get(sitting.value.tenantId)
      .pipe(Effect.orDie);
    const page = yield* expectedSeats(sitting.value, {
      cursor,
      numItems: SITTING_BATCH,
    });
    const createdAt = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(
      page.page,
      (seat) =>
        Effect.gen(function* () {
          const student = yield* reader
            .table("tenantPeople")
            .get(seat.id)
            .pipe(Effect.orDie);
          yield* notice === "examStart"
            ? noticeStudent(sitting.value, tenant, student, createdAt)
            : noticeGuardians(sitting.value, student, createdAt);
        }),
      { discard: true }
    );
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        notificationsInternal.sittings.run,
        { cursor: page.continueCursor, notice, sittingId }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
