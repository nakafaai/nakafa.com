import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

const MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_VIEW_CLEANUP_BATCH_SIZE = 100;
const MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE = 25;

/** Schedules another deleted material cleanup batch. */
function rescheduleDeletedMaterial(
  ctx: MutationCtx,
  args: { materialId: Id<"schoolClassMaterials"> }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.materials.cleanup.cleanupDeletedMaterial
    ),
    args
  );
}

/** Schedules another deleted material group cleanup batch. */
function rescheduleDeletedGroup(
  ctx: MutationCtx,
  args: {
    classId: Id<"schoolClasses">;
    groupId: Id<"schoolClassMaterialGroups">;
  }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.materials.cleanup.cleanupDeletedGroup
    ),
    args
  );
}

/** Removes attachments and views after a material row has been deleted. */
export const cleanupDeletedMaterial = Effect.fn(
  "materialCleanup.cleanupDeletedMaterial"
)(function* (args: { materialId: Id<"schoolClassMaterials"> }) {
  const ctx = yield* MutationCtx;
  const attachments = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialAttachments")
      .withIndex("by_materialId_and_type_and_order", (query) =>
        query.eq("materialId", args.materialId)
      )
      .take(MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE)
  );

  for (const attachment of attachments) {
    yield* Effect.promise(() => ctx.storage.delete(attachment.fileId));
    yield* Effect.promise(() => ctx.db.delete(attachment._id));
  }

  if (attachments.length === MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedMaterial(ctx, args));
    return null;
  }

  const views = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialViews")
      .withIndex("by_materialId_and_userId", (query) =>
        query.eq("materialId", args.materialId)
      )
      .take(MATERIAL_VIEW_CLEANUP_BATCH_SIZE)
  );

  for (const view of views) {
    yield* Effect.promise(() => ctx.db.delete(view._id));
  }

  if (views.length === MATERIAL_VIEW_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedMaterial(ctx, args));
  }

  return null;
});

/** Removes child groups and materials after a material group row has been deleted. */
export const cleanupDeletedGroup = Effect.fn(
  "materialCleanup.cleanupDeletedGroup"
)(function* (args: {
  classId: Id<"schoolClasses">;
  groupId: Id<"schoolClassMaterialGroups">;
}) {
  const ctx = yield* MutationCtx;
  const childGroups = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("by_classId_and_parentId_and_order", (query) =>
        query.eq("classId", args.classId).eq("parentId", args.groupId)
      )
      .take(MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE)
  );

  for (const childGroup of childGroups) {
    yield* Effect.promise(() => ctx.db.delete(childGroup._id));
  }

  if (childGroups.length === MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedGroup(ctx, args));
    return null;
  }

  const materials = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterials")
      .withIndex("by_groupId_and_status_and_isPinned_and_order", (query) =>
        query.eq("groupId", args.groupId)
      )
      .take(MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE)
  );

  for (const material of materials) {
    yield* Effect.promise(() => ctx.db.delete(material._id));
  }

  if (materials.length === MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedGroup(ctx, args));
  }

  return null;
});
