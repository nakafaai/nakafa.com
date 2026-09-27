import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Duration, Effect } from "effect";

/**
 * Trigger handler for schoolClassMaterialGroups table changes.
 *
 * Handles lightweight group delete side effects and schedules bounded cleanup:
 * - Cancels any scheduled jobs associated with the group
 * - Updates parent's child group count
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export const materialGroupsHandler = Effect.fn(
  "triggers.materials.groups.materialGroupsHandler"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMaterialGroups">
) {
  const scheduler = yield* Scheduler.Scheduler.pipe(
    Effect.provide(Scheduler.layer(ctx.scheduler))
  );
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (change.operation !== "delete") {
    return;
  }
  const oldGroup = change.oldDoc;
  const scheduledJobId = oldGroup.scheduledJobId;
  if (scheduledJobId) {
    // Confect Scheduler has no cancellation API; use the Convex SDK boundary.
    yield* Effect.promise(() => ctx.scheduler.cancel(scheduledJobId));
  }
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.triggers.materials.cleanup.cleanupDeletedGroup,
    {
      classId: oldGroup.classId,
      groupId: change.id,
    }
  );
  if (!oldGroup.parentId) {
    return;
  }
  const parent = yield* database
    .table("schoolClassMaterialGroups")
    .get(oldGroup.parentId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!parent) {
    return;
  }
  yield* writer
    .table("schoolClassMaterialGroups")
    .patch(oldGroup.parentId, {
      childGroupCount: Math.max(0, parent.childGroupCount - 1),
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
});
