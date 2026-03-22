import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

const MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_VIEW_CLEANUP_BATCH_SIZE = 100;
const MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE = 25;

/** Deletes one material's attachments and views in bounded batches. */
export const cleanupDeletedMaterial = internalMutation({
  args: {
    materialId: vv.id("schoolClassMaterials"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("schoolClassMaterialAttachments")
      .withIndex("materialId_type_order", (q) =>
        q.eq("materialId", args.materialId)
      )
      .take(MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE);

    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.fileId);
      await ctx.db.delete("schoolClassMaterialAttachments", attachment._id);
    }

    if (attachments.length === MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.materials.cleanup.cleanupDeletedMaterial,
        args
      );

      return null;
    }

    const views = await ctx.db
      .query("schoolClassMaterialViews")
      .withIndex("materialId_userId", (q) =>
        q.eq("materialId", args.materialId)
      )
      .take(MATERIAL_VIEW_CLEANUP_BATCH_SIZE);

    for (const view of views) {
      await ctx.db.delete("schoolClassMaterialViews", view._id);
    }

    if (views.length < MATERIAL_VIEW_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.materials.cleanup.cleanupDeletedMaterial,
      args
    );

    return null;
  },
});

/** Deletes one material group's children and materials in bounded batches. */
export const cleanupDeletedGroup = internalMutation({
  args: {
    classId: vv.id("schoolClasses"),
    groupId: vv.id("schoolClassMaterialGroups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const childGroups = await ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("classId_parentId_order", (q) =>
        q.eq("classId", args.classId).eq("parentId", args.groupId)
      )
      .take(MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE);

    for (const childGroup of childGroups) {
      await ctx.db.delete("schoolClassMaterialGroups", childGroup._id);
    }

    if (childGroups.length === MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.materials.cleanup.cleanupDeletedGroup,
        args
      );

      return null;
    }

    const materials = await ctx.db
      .query("schoolClassMaterials")
      .withIndex("groupId_status_isPinned_order", (q) =>
        q.eq("groupId", args.groupId)
      )
      .take(MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE);

    for (const material of materials) {
      await ctx.db.delete("schoolClassMaterials", material._id);
    }

    if (materials.length < MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.materials.cleanup.cleanupDeletedGroup,
      args
    );

    return null;
  },
});
