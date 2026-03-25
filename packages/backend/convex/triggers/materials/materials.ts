import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClassMaterials table changes.
 *
 * Schedules bounded cleanup for deleted materials:
 * - Deletes file attachments from storage
 * - Removes view tracking records
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function materialsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMaterials">
) {
  const oldMaterial = change.oldDoc;

  if (change.operation !== "delete" || !oldMaterial) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.triggers.materials.cleanup.cleanupDeletedMaterial,
    { materialId: change.id }
  );
}
