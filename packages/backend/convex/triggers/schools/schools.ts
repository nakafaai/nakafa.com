import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { buildSchoolChangesMetadata } from "@repo/backend/convex/triggers/helpers/metadata";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Records school lifecycle changes in the same transaction as their source. */
const recordSchool = Effect.fn("triggers.schools.recordSchool")(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schools">
) {
  const schoolId = change.id;
  if (change.operation === "insert") {
    const school = change.newDoc;
    yield* Effect.promise(() =>
      ctx.db.insert("schoolActivityLogs", {
        schoolId,
        userId: school.createdBy,
        action: "school_created",
        entityType: "schools",
        entityId: schoolId,
        metadata: { schoolName: school.name },
      })
    );
    return;
  }
  if (change.operation === "update") {
    const school = change.newDoc;
    const metadata = buildSchoolChangesMetadata(change.oldDoc, school);
    if (!metadata) {
      return;
    }
    yield* Effect.promise(() =>
      ctx.db.insert("schoolActivityLogs", {
        schoolId,
        userId: school.updatedBy ?? school.createdBy,
        action: "school_updated",
        entityType: "schools",
        entityId: schoolId,
        metadata,
      })
    );
    return;
  }
  const school = change.oldDoc;
  yield* Effect.promise(() =>
    ctx.db.insert("schoolActivityLogs", {
      schoolId,
      userId: school.updatedBy ?? school.createdBy,
      action: "school_deleted",
      entityType: "schools",
      entityId: schoolId,
      metadata: { schoolName: school.name },
    })
  );
});

/** Runs the registered trigger at the native Convex transaction boundary. */
export function schoolsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schools">
) {
  return runConvexProgram(recordSchool(ctx, change));
}
