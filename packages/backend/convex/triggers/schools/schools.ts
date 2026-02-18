import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { buildSchoolChangesMetadata } from "@repo/backend/convex/triggers/helpers/metadata";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schools table changes.
 *
 * Creates activity logs for school lifecycle events:
 * - On insert: Logs school creation with admin member info
 * - On update: Logs field changes (name, email, phone, address, etc.)
 * - On delete: Logs school deletion
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function schoolsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schools">
) {
  const school = change.newDoc;
  const oldSchool = change.oldDoc;
  const schoolId = change.id;

  switch (change.operation) {
    case "insert": {
      if (!school) {
        break;
      }

      const member = await ctx.db
        .query("schoolMembers")
        .withIndex("schoolId_userId_status", (q) =>
          q.eq("schoolId", schoolId).eq("userId", school.createdBy)
        )
        .first();
      const adminMember = isAdmin(member) ? member : null;

      await ctx.db.insert("schoolActivityLogs", {
        schoolId,
        userId: school.createdBy,
        action: "school_created",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: school.name,
          memberId: adminMember?._id,
        },
      });
      break;
    }

    case "update": {
      if (!(school && oldSchool)) {
        break;
      }

      const changesMetadata = buildSchoolChangesMetadata(oldSchool, school);
      if (changesMetadata) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId,
          userId: school.updatedBy ?? school.createdBy,
          action: "school_updated",
          entityType: "schools",
          entityId: schoolId,
          metadata: changesMetadata,
        });
      }
      break;
    }

    case "delete": {
      if (!oldSchool) {
        break;
      }

      await ctx.db.insert("schoolActivityLogs", {
        schoolId,
        userId: oldSchool.updatedBy ?? oldSchool.createdBy,
        action: "school_deleted",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: oldSchool.name,
        },
      });
      break;
    }

    default: {
      break;
    }
  }
}
