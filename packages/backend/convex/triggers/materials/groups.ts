import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

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
export async function materialGroupsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMaterialGroups">
) {
  const oldGroup = change.oldDoc;

  if (change.operation !== "delete" || !oldGroup) {
    return;
  }

  if (oldGroup.scheduledJobId) {
    await ctx.scheduler.cancel(oldGroup.scheduledJobId);
  }

  await ctx.scheduler.runAfter(
    0,
    internal.triggers.materials.cleanup.cleanupDeletedGroup,
    {
      classId: oldGroup.classId,
      groupId: change.id,
    }
  );

  if (!oldGroup.parentId) {
    return;
  }

  const parent = await ctx.db.get(
    "schoolClassMaterialGroups",
    oldGroup.parentId
  );

  if (!parent) {
    return;
  }

  await ctx.db.patch("schoolClassMaterialGroups", oldGroup.parentId, {
    childGroupCount: Math.max(0, parent.childGroupCount - 1),
    updatedAt: Date.now(),
  });
}
