import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/triggers/materials/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const GROUP_CLEANUP_BATCH_SIZE = 25;

const cleanupDeletedGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedGroup",
  Effect.fn("triggers.materials.cleanup.cleanupDeletedGroup")(function* (args) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const childGroups = yield* database
      .table("schoolClassMaterialGroups")
      .index("by_classId_and_parentId_and_order", (q) =>
        q.eq("classId", args.classId).eq("parentId", args.groupId)
      )
      .take(GROUP_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const childGroup of childGroups) {
      yield* writer.table("schoolClassMaterialGroups").delete(childGroup._id);
    }
    if (childGroups.length === GROUP_CLEANUP_BATCH_SIZE) {
      const scheduler = yield* Scheduler;
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.materials.cleanup.cleanupDeletedGroup,
        args
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedGroup),
  Layer.provide(atomic),
  GroupImpl.finalize
);
