import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { buildClassChangesMetadata } from "@repo/backend/convex/triggers/helpers/metadata";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClasses table changes.
 *
 * Manages class lifecycle events and activity logging:
 * - On insert: Logs class creation with metadata
 * - On update: Logs archive/unarchive events and field changes
 * - On delete: Logs class deletion and removes all class members
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function schoolClassesHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClasses">
) {
  const classDoc = change.newDoc;
  const oldClassDoc = change.oldDoc;
  const classId: Id<"schoolClasses"> = change.id;

  switch (change.operation) {
    case "insert": {
      if (!classDoc) {
        break;
      }

      await ctx.db.insert("schoolActivityLogs", {
        schoolId: classDoc.schoolId,
        userId: classDoc.createdBy,
        action: "class_created",
        entityType: "classes",
        entityId: classId,
        metadata: {
          className: classDoc.name,
          subject: classDoc.subject,
          year: classDoc.year,
        },
      });
      break;
    }

    case "update": {
      if (!(classDoc && oldClassDoc)) {
        break;
      }

      if (oldClassDoc.isArchived !== classDoc.isArchived) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: classDoc.schoolId,
          userId:
            classDoc.archivedBy ?? classDoc.updatedBy ?? classDoc.createdBy,
          action: "class_archived",
          entityType: "classes",
          entityId: classId,
          metadata: {
            className: classDoc.name,
            isArchived: classDoc.isArchived,
            archivedAt: classDoc.archivedAt,
          },
        });
      }

      const changesMetadata = buildClassChangesMetadata(oldClassDoc, classDoc);
      if (changesMetadata) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: classDoc.schoolId,
          userId: classDoc.updatedBy ?? classDoc.createdBy,
          action: "class_updated",
          entityType: "classes",
          entityId: classId,
          metadata: changesMetadata,
        });
      }
      break;
    }

    case "delete": {
      if (!oldClassDoc) {
        break;
      }

      await ctx.db.insert("schoolActivityLogs", {
        schoolId: oldClassDoc.schoolId,
        userId: oldClassDoc.updatedBy ?? oldClassDoc.createdBy,
        action: "class_deleted",
        entityType: "classes",
        entityId: classId,
        metadata: {
          className: oldClassDoc.name,
          subject: oldClassDoc.subject,
          year: oldClassDoc.year,
        },
      });

      const classMembers = await ctx.db
        .query("schoolClassMembers")
        .withIndex("classId_userId", (q) => q.eq("classId", classId))
        .collect();

      for (const member of classMembers) {
        await ctx.db.delete("schoolClassMembers", member._id);
      }
      break;
    }

    default: {
      break;
    }
  }
}
