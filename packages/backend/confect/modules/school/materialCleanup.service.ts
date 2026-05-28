import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { Duration, Effect } from "effect";

const MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_VIEW_CLEANUP_BATCH_SIZE = 100;
const MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE = 25;
const MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE = 25;

/** Removes attachments and views after a material row has been deleted. */
export const cleanupDeletedMaterial = Effect.fn(
  "materialCleanup.cleanupDeletedMaterial"
)(function* (args: { materialId: Id<"schoolClassMaterials"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const storage = yield* StorageWriter;
  const scheduler = yield* Scheduler;
  const attachments = yield* reader
    .table("schoolClassMaterialAttachments")
    .index("by_materialId_and_type_and_order", (query) =>
      query.eq("materialId", args.materialId)
    )
    .take(MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE);

  for (const attachment of attachments) {
    yield* storage.delete(attachment.fileId);
    yield* writer
      .table("schoolClassMaterialAttachments")
      .delete(attachment._id);
  }

  if (attachments.length === MATERIAL_ATTACHMENT_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.materials.cleanup.cleanupDeletedMaterial,
      args
    );
    return null;
  }

  const views = yield* reader
    .table("schoolClassMaterialViews")
    .index("by_materialId_and_userId", (query) =>
      query.eq("materialId", args.materialId)
    )
    .take(MATERIAL_VIEW_CLEANUP_BATCH_SIZE);

  for (const view of views) {
    yield* writer.table("schoolClassMaterialViews").delete(view._id);
  }

  if (views.length === MATERIAL_VIEW_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.materials.cleanup.cleanupDeletedMaterial,
      args
    );
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
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const childGroups = yield* reader
    .table("schoolClassMaterialGroups")
    .index("by_classId_and_parentId_and_order", (query) =>
      query.eq("classId", args.classId).eq("parentId", args.groupId)
    )
    .take(MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE);

  for (const childGroup of childGroups) {
    yield* writer.table("schoolClassMaterialGroups").delete(childGroup._id);
  }

  if (childGroups.length === MATERIAL_GROUP_CHILD_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.materials.cleanup.cleanupDeletedGroup,
      args
    );
    return null;
  }

  const materials = yield* reader
    .table("schoolClassMaterials")
    .index("by_groupId_and_status_and_isPinned_and_order", (query) =>
      query.eq("groupId", args.groupId)
    )
    .take(MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE);

  for (const material of materials) {
    yield* writer.table("schoolClassMaterials").delete(material._id);
  }

  if (materials.length === MATERIAL_GROUP_MATERIAL_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.materials.cleanup.cleanupDeletedGroup,
      args
    );
  }

  return null;
});
