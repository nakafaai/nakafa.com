import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { buildSchoolChangesMetadata } from "@repo/backend/confect/triggers/helpers/metadata";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Records school lifecycle changes in the same transaction as their source. */
export const schoolsHandler = Effect.fn("triggers.schools.recordSchool")(
  function* (change: Change<DataModel, "schools">) {
    const writer = yield* DatabaseWriter;
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
