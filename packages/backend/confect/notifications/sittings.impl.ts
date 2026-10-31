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
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import spec from "@repo/backend/confect/notifications/sittings.spec";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** Students one run reads, the batch of ADR 0027. */
const SITTING_BATCH = 100;

/** The guardians of one student that a reminder reaches: a student has few, and a page holds them all. */
const GUARDIAN_LIMIT = 10;

/** Writes the start notice of a sitting for one student it expects, and schedules its push. */
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
    notificationId,
    student,
    principal.grants,
    sitting.unitId
  );
});

/** Writes the reminder of a sitting for each active guardian with a verified link to one student it expects. */
const noticeGuardians = Effect.fn("notifications.sittings.guardians")(
  function* (
    sitting: ExamSittingsDoc,
    student: TenantPeopleDoc,
    createdAt: number
  ) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const links = yield* reader
      .table("guardianLinks")
      .index("by_studentPersonId_and_state_status", (query) =>
        query.eq("studentPersonId", student._id).eq("state.status", "verified")
      )
      .take(GUARDIAN_LIMIT)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      links,
      (link) =>
        Effect.gen(function* () {
          const guardian = yield* reader
            .table("tenantPeople")
            .get(link.guardianPersonId);
          if (guardian.status !== "active") {
            return;
          }
          yield* writer.table("notifications").insert({
            changeType: "exam.reminder",
            createdAt,
            recipientPersonId: guardian._id,
            sittingId: sitting._id,
            studentPersonId: student._id,
            subject: { id: sitting._id, kind: "sitting" },
            tenantId: sitting.tenantId,
          });
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
