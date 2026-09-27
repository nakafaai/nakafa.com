import { DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { buildSchoolChangesMetadata } from "@repo/backend/confect/triggers/helpers/metadata";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Records school lifecycle changes in the same transaction as their source. */
export const schoolsHandler = Effect.fn("triggers.schools.recordSchool")(
  function* (
    ctx: GenericMutationCtx<DataModel>,
    change: Change<DataModel, "schools">
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const schoolId = change.id;
    if (change.operation === "insert") {
      const school = change.newDoc;
      yield* writer.table("schoolActivityLogs").insert({
        schoolId,
        userId: school.createdBy,
        action: "school_created",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: school.name,
        },
      });
      return;
    }
    if (change.operation === "update") {
      const school = change.newDoc;
      const metadata = buildSchoolChangesMetadata(change.oldDoc, school);
      if (!metadata) {
        return;
      }
      yield* writer.table("schoolActivityLogs").insert({
        schoolId,
        userId: school.updatedBy ?? school.createdBy,
        action: "school_updated",
        entityType: "schools",
        entityId: schoolId,
        metadata,
      });
      return;
    }
    const school = change.oldDoc;
    yield* writer.table("schoolActivityLogs").insert({
      schoolId,
      userId: school.updatedBy ?? school.createdBy,
      action: "school_deleted",
      entityType: "schools",
      entityId: schoolId,
      metadata: {
        schoolName: school.name,
      },
    });
  },
  Effect.orDie
);
