import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClassMaterialGroups table changes.
 *
 * Handles hierarchical deletion of material groups:
 * - Cancels any scheduled jobs associated with the group
 * - Recursively deletes all child groups (via trigger cascade)
 * - Deletes all materials in the group (via trigger cascade)
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

  switch (change.operation) {
    case "delete": {
      if (!oldGroup) {
        break;
      }

      if (oldGroup.scheduledJobId) {
        await ctx.scheduler.cancel(oldGroup.scheduledJobId);
      }

      const childGroups = await ctx.db
        .query("schoolClassMaterialGroups")
        .withIndex("classId_parentId_order", (q) =>
          q.eq("classId", oldGroup.classId).eq("parentId", change.id)
        )
        .collect();

      for (const child of childGroups) {
        await ctx.db.delete("schoolClassMaterialGroups", child._id);
      }

      const materials = await ctx.db
        .query("schoolClassMaterials")
        .withIndex("groupId_status_isPinned_order", (q) =>
          q.eq("groupId", change.id)
        )
        .collect();

      for (const material of materials) {
        await ctx.db.delete("schoolClassMaterials", material._id);
      }

      if (oldGroup.parentId) {
        const parent = await ctx.db.get(
          "schoolClassMaterialGroups",
          oldGroup.parentId
        );
        if (parent) {
          await ctx.db.patch("schoolClassMaterialGroups", oldGroup.parentId, {
            childGroupCount: Math.max(0, parent.childGroupCount - 1),
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
}
