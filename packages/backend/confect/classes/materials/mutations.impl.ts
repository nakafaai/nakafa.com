import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveClass } from "@repo/backend/confect/classes/access";
import {
  loadMaterialGroup,
  validateScheduledStatus,
} from "@repo/backend/confect/classes/materials/groups";
import spec from "@repo/backend/confect/classes/materials/mutations.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { requirePermission } from "@repo/backend/confect/schools/permission/access";
import { PERMISSIONS } from "@repo/backend/confect/schools/permission/spec";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** Creates a group and schedules its publication atomically when requested. */
const createMaterialGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "createMaterialGroup",
  Effect.fn("classes.materials.mutations.createMaterialGroup")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const { appUser } = yield* requireAuth(ctx);
      const userId = appUser._id;
      yield* validateScheduledStatus(args.status, args.scheduledAt);
      const classData = yield* loadActiveClass(ctx, args.classId);
      yield* requirePermission(PERMISSIONS.CONTENT_CREATE, {
        userId,
        classId: args.classId,
        schoolId: classData.schoolId,
      });

      // Get next order using index (efficient: uses .first() not .collect())
      const lastGroup = yield* database
        .table("schoolClassMaterialGroups")
        .index(
          "by_classId_and_parentId_and_order",
          (q) => q.eq("classId", args.classId).eq("parentId", undefined),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const order = (lastGroup?.order ?? -1) + 1;
      const now = yield* Clock.currentTimeMillis;
      const isScheduled = args.status === "scheduled";
      const isPublished = args.status === "published";
      const groupId = yield* writer
        .table("schoolClassMaterialGroups")
        .insert({
          classId: args.classId,
          schoolId: classData.schoolId,
          name: args.name,
          description: args.description,
          order,
          status: args.status,
          ...(isScheduled && args.scheduledAt !== undefined
            ? {
                scheduledAt: args.scheduledAt,
              }
            : {}),
          // Set publishedAt/publishedBy immediately when creating as "published"
          ...(isPublished
            ? {
                publishedAt: now,
              }
            : {}),
          ...(isPublished
            ? {
                publishedBy: userId,
              }
            : {}),
          materialCount: 0,
          childGroupCount: 0,
          createdBy: userId,
          updatedAt: now,
        })
        .pipe(Effect.orDie);

      // Schedule publish job if needed (requires groupId, so separate patch)
      const scheduledAt = args.scheduledAt;
      if (isScheduled && scheduledAt) {
        const scheduledJobId = yield* (yield* Scheduler).runAfter(
          Duration.millis(Math.max(scheduledAt - now, 0)),
          refs.internal.classes.materials.mutations.publishMaterialGroup,
          {
            groupId,
            publishedBy: userId,
          }
        );
        yield* writer
          .table("schoolClassMaterialGroups")
          .patch(groupId, {
            scheduledJobId,
          })
          .pipe(Effect.orDie);
      }
      return groupId;
    }
  )
);
const updateMaterialGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateMaterialGroup",
  Effect.fn("classes.materials.mutations.updateMaterialGroup")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const ctx = yield* MutationCtxService;
      const { appUser } = yield* requireAuth(ctx);
      const userId = appUser._id;
      const group = yield* loadMaterialGroup(ctx, args.groupId);
      const newStatus = args.status ?? group.status;
      const newScheduledAt = args.scheduledAt ?? group.scheduledAt;
      yield* validateScheduledStatus(newStatus, newScheduledAt);
      const classData = yield* loadActiveClass(ctx, group.classId);
      yield* requirePermission(PERMISSIONS.CONTENT_EDIT, {
        userId,
        classId: group.classId,
        schoolId: classData.schoolId,
      });
      const now = yield* Clock.currentTimeMillis;
      const wasPublished = group.status === "published";
      const willBePublished = newStatus === "published";
      const wasScheduled = group.status === "scheduled";
      const willBeScheduled = newStatus === "scheduled";
      const timeChanged = newScheduledAt !== group.scheduledAt;

      // Determine scheduling changes
      const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
      const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);
      const previousJobId = group.scheduledJobId;
      let scheduledJobId = previousJobId;

      // Cancel existing job if status changed or time changed
      if (needsCancel && previousJobId) {
        yield* Effect.promise(async () => ctx.scheduler.cancel(previousJobId));
        scheduledJobId = undefined;
      }

      // Schedule new job if needed
      if (needsSchedule && newScheduledAt) {
        scheduledJobId = yield* (yield* Scheduler).runAfter(
          Duration.millis(Math.max(newScheduledAt - now, 0)),
          refs.internal.classes.materials.mutations.publishMaterialGroup,
          {
            groupId: args.groupId,
            publishedBy: userId,
          }
        );
      }

      // Determine published fields
      const isNewlyPublished = willBePublished && !wasPublished;
      yield* writer
        .table("schoolClassMaterialGroups")
        .patch(args.groupId, {
          name: args.name ?? group.name,
          description: args.description ?? group.description,
          status: newStatus,
          scheduledAt: willBeScheduled ? newScheduledAt : undefined,
          scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
          // Set publishedAt/publishedBy when changing to "published"
          publishedAt: isNewlyPublished ? now : group.publishedAt,
          publishedBy: isNewlyPublished ? userId : group.publishedBy,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return args.groupId;
    }
  )
);
const publishMaterialGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "publishMaterialGroup",
  Effect.fn("classes.materials.mutations.publishMaterialGroup")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const group = yield* database
        .table("schoolClassMaterialGroups")
        .get(args.groupId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (group?.status !== "scheduled") {
        return null;
      }
      const now = yield* Clock.currentTimeMillis;
      yield* writer
        .table("schoolClassMaterialGroups")
        .patch(args.groupId, {
          status: "published",
          scheduledAt: undefined,
          scheduledJobId: undefined,
          publishedAt: now,
          publishedBy: args.publishedBy,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return null;
    }
  )
);
const deleteMaterialGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteMaterialGroup",
  Effect.fn("classes.materials.mutations.deleteMaterialGroup")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const ctx = yield* MutationCtxService;
      const { appUser } = yield* requireAuth(ctx);
      const userId = appUser._id;
      const group = yield* loadMaterialGroup(ctx, args.groupId);
      const classData = yield* loadActiveClass(ctx, group.classId);
      yield* requirePermission(PERMISSIONS.CONTENT_DELETE, {
        userId,
        classId: group.classId,
        schoolId: classData.schoolId,
      });
      const previousJobId = group.scheduledJobId;
      if (group.status === "scheduled" && previousJobId) {
        yield* Effect.promise(async () => ctx.scheduler.cancel(previousJobId));
      }

      // Triggers drain child groups and maintain the parent count.
      yield* writer.table("schoolClassMaterialGroups").delete(args.groupId);
      return null;
    }
  )
);
const reorderMaterialGroup = FunctionImpl.make(
  databaseSchema,
  spec,
  "reorderMaterialGroup",
  Effect.fn("classes.materials.mutations.reorderMaterialGroup")(
    function* (args) {
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const { appUser } = yield* requireAuth(ctx);
      const userId = appUser._id;
      const group = yield* loadMaterialGroup(ctx, args.groupId);
      const classData = yield* loadActiveClass(ctx, group.classId);
      yield* requirePermission(PERMISSIONS.CONTENT_EDIT, {
        userId,
        classId: group.classId,
        schoolId: classData.schoolId,
      });

      // Find adjacent group to swap with using index range query
      const adjacentGroup =
        args.direction === "up"
          ? yield* database
              .table("schoolClassMaterialGroups")
              .index(
                "by_classId_and_parentId_and_order",
                (q) =>
                  q
                    .eq("classId", group.classId)
                    .eq("parentId", group.parentId)
                    .lt("order", group.order),
                "desc"
              )
              .first()
              .pipe(Effect.map(Option.getOrNull), Effect.orDie)
          : yield* database
              .table("schoolClassMaterialGroups")
              .index(
                "by_classId_and_parentId_and_order",
                (q) =>
                  q
                    .eq("classId", group.classId)
                    .eq("parentId", group.parentId)
                    .gt("order", group.order),
                "asc"
              )
              .first()
              .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!adjacentGroup) {
        // Already at the edge, nothing to do
        return null;
      }

      // Swap orders
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.all([
        (yield* DatabaseWriter)
          .table("schoolClassMaterialGroups")
          .patch(group._id, {
            order: adjacentGroup.order,
            updatedAt: now,
          })
          .pipe(Effect.orDie),
        (yield* DatabaseWriter)
          .table("schoolClassMaterialGroups")
          .patch(adjacentGroup._id, {
            order: group.order,
            updatedAt: now,
          })
          .pipe(Effect.orDie),
      ]);
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createMaterialGroup),
  Layer.provide(updateMaterialGroup),
  Layer.provide(publishMaterialGroup),
  Layer.provide(deleteMaterialGroup),
  Layer.provide(reorderMaterialGroup),
  Layer.provide(atomic),
  GroupImpl.finalize
);
