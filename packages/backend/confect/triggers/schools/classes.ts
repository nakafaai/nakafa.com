import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { buildClassChangesMetadata } from "@repo/backend/confect/triggers/helpers/metadata";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect, Struct } from "effect";

/** Records class changes and schedules bounded cleanup after deletion. */
export const schoolClassesHandler = Effect.fn("triggers.schools.recordClass")(
  function* (change: Change<DataModel, "schoolClasses">) {
    const scheduler = yield* Scheduler;
    const writer = yield* DatabaseWriter;
    const classId = change.id;
    if (change.operation === "insert") {
      const classroom = change.newDoc;
      yield* writer
        .table("schoolActivityLogs")
        .insert({
          schoolId: classroom.schoolId,
          userId: classroom.createdBy,
          action: "class_created",
          entityType: "schoolClasses",
          entityId: classId,
          metadata: {
            className: classroom.name,
            subject: classroom.subject,
            year: classroom.year,
          },
        })
        .pipe(Effect.orDie);
      return;
    }
    if (change.operation === "update") {
      const classroom = change.newDoc;
      if (change.oldDoc.isArchived !== classroom.isArchived) {
        yield* writer
          .table("schoolActivityLogs")
          .insert({
            schoolId: classroom.schoolId,
            userId:
              classroom.archivedBy ??
              classroom.updatedBy ??
              classroom.createdBy,
            action: "class_archived",
            entityType: "schoolClasses",
            entityId: classId,
            metadata: {
              className: classroom.name,
              isArchived: classroom.isArchived,
              ...Struct.pick(classroom, ["archivedAt"]),
            },
          })
          .pipe(Effect.orDie);
      }
      const metadata = buildClassChangesMetadata(change.oldDoc, classroom);
      if (metadata) {
        yield* writer
          .table("schoolActivityLogs")
          .insert({
            schoolId: classroom.schoolId,
            userId: classroom.updatedBy ?? classroom.createdBy,
            action: "class_updated",
            entityType: "schoolClasses",
            entityId: classId,
            metadata,
          })
          .pipe(Effect.orDie);
      }
      return;
    }
    const classroom = change.oldDoc;
    yield* writer
      .table("schoolActivityLogs")
      .insert({
        schoolId: classroom.schoolId,
        userId: classroom.updatedBy ?? classroom.createdBy,
        action: "class_deleted",
        entityType: "schoolClasses",
        entityId: classId,
        metadata: {
          className: classroom.name,
          subject: classroom.subject,
          year: classroom.year,
        },
      })
      .pipe(Effect.orDie);
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
      {
        classId,
      }
    );
  }
);
