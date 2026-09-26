import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { buildClassChangesMetadata } from "@repo/backend/convex/triggers/helpers/metadata";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, Struct } from "effect";

/** Records class changes and schedules bounded cleanup after deletion. */
const recordClass = Effect.fn("triggers.schools.recordClass")(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClasses">
) {
  const classId = change.id;
  if (change.operation === "insert") {
    const classroom = change.newDoc;
    yield* Effect.promise(() =>
      ctx.db.insert("schoolActivityLogs", {
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
    );
    return;
  }
  if (change.operation === "update") {
    const classroom = change.newDoc;
    if (change.oldDoc.isArchived !== classroom.isArchived) {
      yield* Effect.promise(() =>
        ctx.db.insert("schoolActivityLogs", {
          schoolId: classroom.schoolId,
          userId:
            classroom.archivedBy ?? classroom.updatedBy ?? classroom.createdBy,
          action: "class_archived",
          entityType: "schoolClasses",
          entityId: classId,
          metadata: {
            className: classroom.name,
            isArchived: classroom.isArchived,
            ...Struct.pick(classroom, ["archivedAt"]),
          },
        })
      );
    }
    const metadata = buildClassChangesMetadata(change.oldDoc, classroom);
    if (metadata) {
      yield* Effect.promise(() =>
        ctx.db.insert("schoolActivityLogs", {
          schoolId: classroom.schoolId,
          userId: classroom.updatedBy ?? classroom.createdBy,
          action: "class_updated",
          entityType: "schoolClasses",
          entityId: classId,
          metadata,
        })
      );
    }
    return;
  }
  const classroom = change.oldDoc;
  yield* Effect.promise(() =>
    ctx.db.insert("schoolActivityLogs", {
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
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      internal.triggers.schools.cleanup.cleanupDeletedClass,
      { classId }
    )
  );
});

/** Runs the registered trigger at the native Convex transaction boundary. */
export function schoolClassesHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClasses">
) {
  return runConvexProgram(recordClass(ctx, change));
}
