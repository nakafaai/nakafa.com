import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClassMaterials table changes.
 *
 * Cascades deletion to all material attachments and view records:
 * - Deletes all file attachments from storage
 * - Removes all view tracking records
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function materialsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMaterials">
) {
  const oldMaterial = change.oldDoc;

  switch (change.operation) {
    case "delete": {
      if (!oldMaterial) {
        break;
      }

      const attachments = await ctx.db
        .query("schoolClassMaterialAttachments")
        .withIndex("materialId_type_order", (q) =>
          q.eq("materialId", change.id)
        )
        .collect();

      for (const attachment of attachments) {
        await ctx.storage.delete(attachment.fileId);
        await ctx.db.delete("schoolClassMaterialAttachments", attachment._id);
      }

      const views = await ctx.db
        .query("schoolClassMaterialViews")
        .withIndex("materialId_userId", (q) => q.eq("materialId", change.id))
        .collect();

      for (const view of views) {
        await ctx.db.delete("schoolClassMaterialViews", view._id);
      }
      break;
    }

    default: {
      break;
    }
  }
}
