import { Ref } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import {
  getUserMap,
  isAdmin,
  loadActiveClass,
  loadClass,
  requireClassAccess,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type { SchoolClassMaterialStatus } from "@repo/backend/confect/modules/school/classes.tables";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import type { PaginationOptions } from "convex/server";
import { Clock, Effect } from "effect";

/** Fails when scheduled material status is missing a future timestamp. */
function validateScheduledStatus(
  status: SchoolClassMaterialStatus,
  scheduledAt: number | undefined,
  now: number
) {
  if (status !== "scheduled") {
    return Effect.succeed(null);
  }

  if (scheduledAt === undefined) {
    return Effect.fail(
      new ClassActionError({
        message: "scheduledAt is required when status is scheduled.",
      })
    );
  }

  if (scheduledAt <= now) {
    return Effect.fail(
      new ClassActionError({ message: "scheduledAt must be in the future." })
    );
  }

  return Effect.succeed(null);
}

/** Loads a material group or fails with the domain class error. */
const loadMaterialGroup = Effect.fn("school.materials.loadMaterialGroup")(
  function* (groupId: Id<"schoolClassMaterialGroups">) {
    const ctx = yield* MutationCtx;
    const group = yield* Effect.promise(() => ctx.db.get(groupId));

    if (!group) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Material group not found." })
      );
    }

    return group;
  }
);

/** Adds creator and publisher user summaries to material groups. */
const enrichMaterialGroups = Effect.fn("school.materials.enrichMaterialGroups")(
  function* (groups: Doc<"schoolClassMaterialGroups">[]) {
    const ctx = yield* QueryCtx;

    if (groups.length === 0) {
      return [];
    }

    const userIds = groups.flatMap((group) =>
      group.publishedBy
        ? [group.createdBy, group.publishedBy]
        : [group.createdBy]
    );
    const userMap = yield* getUserMap(ctx, userIds);

    return groups.map((group) => ({
      ...group,
      publishedByUser: group.publishedBy
        ? (userMap.get(group.publishedBy) ?? null)
        : null,
      user: userMap.get(group.createdBy) ?? null,
    }));
  }
);

/** Creates a material group and optionally schedules publication. */
export const createMaterialGroup = Effect.fn(
  "school.materials.createMaterialGroup"
)(function* (args: {
  classId: Id<"schoolClasses">;
  description: string;
  name: string;
  scheduledAt?: number;
  status: SchoolClassMaterialStatus;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const now = yield* Clock.currentTimeMillis;
  yield* validateScheduledStatus(args.status, args.scheduledAt, now);

  const classData = yield* loadActiveClass(ctx, args.classId);
  yield* requirePermission(ctx, PERMISSIONS.CONTENT_CREATE, {
    classId: args.classId,
    schoolId: classData.schoolId,
    userId,
  });

  const lastGroup = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("by_classId_and_parentId_and_order", (query) =>
        query.eq("classId", args.classId).eq("parentId", undefined)
      )
      .order("desc")
      .first()
  );
  const isScheduled = args.status === "scheduled";
  const isPublished = args.status === "published";
  const groupId = yield* Effect.promise(() =>
    ctx.db.insert("schoolClassMaterialGroups", {
      childGroupCount: 0,
      classId: args.classId,
      createdBy: userId,
      description: args.description,
      materialCount: 0,
      name: args.name,
      order: (lastGroup?.order ?? -1) + 1,
      publishedAt: isPublished ? now : undefined,
      publishedBy: isPublished ? userId : undefined,
      scheduledAt: isScheduled ? args.scheduledAt : undefined,
      schoolId: classData.schoolId,
      status: args.status,
      updatedAt: now,
    })
  );

  if (isScheduled && args.scheduledAt !== undefined) {
    const scheduledAt = args.scheduledAt;
    const scheduledJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        Math.max(scheduledAt - now, 0),
        Ref.getFunctionReference(
          refs.internal.classes.materials.mutations.publishMaterialGroup
        ),
        { groupId, publishedBy: userId }
      )
    );
    yield* Effect.promise(() =>
      ctx.db.patch(groupId, {
        scheduledJobId,
      })
    );
  }

  return groupId;
});

/** Updates material group metadata, status, and scheduled publication. */
export const updateMaterialGroup = Effect.fn(
  "school.materials.updateMaterialGroup"
)(function* (args: {
  description?: string;
  groupId: Id<"schoolClassMaterialGroups">;
  name?: string;
  scheduledAt?: number;
  status?: SchoolClassMaterialStatus;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const nextStatus = args.status ?? group.status;
  const nextScheduledAt = args.scheduledAt ?? group.scheduledAt;
  const now = yield* Clock.currentTimeMillis;
  yield* validateScheduledStatus(nextStatus, nextScheduledAt, now);

  const classData = yield* loadActiveClass(ctx, group.classId);
  yield* requirePermission(ctx, PERMISSIONS.CONTENT_EDIT, {
    classId: group.classId,
    schoolId: classData.schoolId,
    userId,
  });

  const wasPublished = group.status === "published";
  const willBePublished = nextStatus === "published";
  const wasScheduled = group.status === "scheduled";
  const willBeScheduled = nextStatus === "scheduled";
  const timeChanged = nextScheduledAt !== group.scheduledAt;
  const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
  const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);
  let scheduledJobId = group.scheduledJobId;

  if (needsCancel && group.scheduledJobId) {
    const cancelledJobId = group.scheduledJobId;
    yield* Effect.promise(() => ctx.scheduler.cancel(cancelledJobId));
    scheduledJobId = undefined;
  }

  if (needsSchedule && nextScheduledAt !== undefined) {
    scheduledJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        Math.max(nextScheduledAt - now, 0),
        Ref.getFunctionReference(
          refs.internal.classes.materials.mutations.publishMaterialGroup
        ),
        { groupId: args.groupId, publishedBy: userId }
      )
    );
  }

  const isNewlyPublished = willBePublished && !wasPublished;
  yield* Effect.promise(() =>
    ctx.db.patch(args.groupId, {
      description: args.description ?? group.description,
      name: args.name ?? group.name,
      publishedAt: isNewlyPublished ? now : group.publishedAt,
      publishedBy: isNewlyPublished ? userId : group.publishedBy,
      scheduledAt: willBeScheduled ? nextScheduledAt : undefined,
      scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
      status: nextStatus,
      updatedAt: now,
    })
  );

  return args.groupId;
});

/** Publishes a scheduled material group. */
export const publishMaterialGroup = Effect.fn(
  "school.materials.publishMaterialGroup"
)(function* (args: {
  groupId: Id<"schoolClassMaterialGroups">;
  publishedBy: Id<"users">;
}) {
  const ctx = yield* MutationCtx;
  const group = yield* Effect.promise(() => ctx.db.get(args.groupId));

  if (!group || group.status !== "scheduled") {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.patch(args.groupId, {
      publishedAt: now,
      publishedBy: args.publishedBy,
      scheduledAt: undefined,
      scheduledJobId: undefined,
      status: "published",
      updatedAt: now,
    })
  );

  return null;
});

/** Deletes a material group after permission checks. */
export const deleteMaterialGroup = Effect.fn(
  "school.materials.deleteMaterialGroup"
)(function* (args: { groupId: Id<"schoolClassMaterialGroups"> }) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const classData = yield* loadActiveClass(ctx, group.classId);
  yield* requirePermission(ctx, PERMISSIONS.CONTENT_DELETE, {
    classId: group.classId,
    schoolId: classData.schoolId,
    userId,
  });

  if (group.status === "scheduled" && group.scheduledJobId) {
    const scheduledJobId = group.scheduledJobId;
    yield* Effect.promise(() => ctx.scheduler.cancel(scheduledJobId));
  }

  yield* Effect.promise(() => ctx.db.delete(args.groupId));
  return null;
});

/** Swaps a material group order with the nearest adjacent group. */
export const reorderMaterialGroup = Effect.fn(
  "school.materials.reorderMaterialGroup"
)(function* (args: {
  direction: "up" | "down";
  groupId: Id<"schoolClassMaterialGroups">;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const classData = yield* loadActiveClass(ctx, group.classId);
  yield* requirePermission(ctx, PERMISSIONS.CONTENT_EDIT, {
    classId: group.classId,
    schoolId: classData.schoolId,
    userId,
  });

  const adjacentGroup =
    args.direction === "up"
      ? yield* Effect.promise(() =>
          ctx.db
            .query("schoolClassMaterialGroups")
            .withIndex("by_classId_and_parentId_and_order", (query) =>
              query
                .eq("classId", group.classId)
                .eq("parentId", group.parentId)
                .lt("order", group.order)
            )
            .order("desc")
            .first()
        )
      : yield* Effect.promise(() =>
          ctx.db
            .query("schoolClassMaterialGroups")
            .withIndex("by_classId_and_parentId_and_order", (query) =>
              query
                .eq("classId", group.classId)
                .eq("parentId", group.parentId)
                .gt("order", group.order)
            )
            .order("asc")
            .first()
        );

  if (!adjacentGroup) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.all([
    Effect.promise(() =>
      ctx.db.patch(group._id, {
        order: adjacentGroup.order,
        updatedAt: now,
      })
    ),
    Effect.promise(() =>
      ctx.db.patch(adjacentGroup._id, {
        order: group.order,
        updatedAt: now,
      })
    ),
  ]);

  return null;
});

/** Lists material groups visible to the current class user. */
export const getMaterialGroups = Effect.fn(
  "school.materials.getMaterialGroups"
)(function* (args: {
  classId: Id<"schoolClasses">;
  paginationOpts: PaginationOptions;
  parentId?: Id<"schoolClassMaterialGroups">;
  q?: string;
}) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const classData = yield* loadClass(ctx, args.classId);
  const access = yield* requireClassAccess(
    ctx,
    args.classId,
    classData.schoolId,
    user.appUser._id
  );
  const canSeeAllStatuses =
    access.classMembership?.role === "teacher" ||
    isAdmin(access.schoolMembership);
  const searchQuery = args.q?.trim();
  const parentId = args.parentId;

  if (searchQuery) {
    const groupsPage = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassMaterialGroups")
        .withSearchIndex("search_name", (query) => {
          const builder = query
            .search("name", searchQuery)
            .eq("classId", args.classId)
            .eq("parentId", parentId);

          if (canSeeAllStatuses) {
            return builder;
          }

          return builder.eq("status", "published");
        })
        .paginate(args.paginationOpts)
    );
    const page = yield* enrichMaterialGroups(groupsPage.page);

    return { ...groupsPage, page };
  }

  if (canSeeAllStatuses) {
    const groupsPage = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassMaterialGroups")
        .withIndex("by_classId_and_parentId_and_order", (query) =>
          query.eq("classId", args.classId).eq("parentId", parentId)
        )
        .order("asc")
        .paginate(args.paginationOpts)
    );
    const page = yield* enrichMaterialGroups(groupsPage.page);

    return { ...groupsPage, page };
  }

  const groupsPage = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("by_classId_and_parentId_and_status_and_order", (query) =>
        query
          .eq("classId", args.classId)
          .eq("parentId", parentId)
          .eq("status", "published")
      )
      .order("asc")
      .paginate(args.paginationOpts)
  );
  const page = yield* enrichMaterialGroups(groupsPage.page);

  return { ...groupsPage, page };
});
