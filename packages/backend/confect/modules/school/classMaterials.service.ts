import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import {
  getUserMap,
  isAdmin,
  loadActiveClass,
  loadClass,
  requireClassAccess,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type {
  SchoolClassMaterialGroups,
  SchoolClassMaterialStatus,
} from "@repo/backend/confect/modules/school/classes.tables";
import type { OrderDirection } from "@repo/backend/confect/modules/school/order.schemas";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import type { PaginationOptions } from "convex/server";
import { Clock, Duration, Effect, Option } from "effect";

type MaterialGroup = typeof SchoolClassMaterialGroups.Doc.Type;

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
    const reader = yield* DatabaseReader;
    const group = yield* reader
      .table("schoolClassMaterialGroups")
      .get(groupId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
  function* (groups: readonly MaterialGroup[]) {
    if (groups.length === 0) {
      return [];
    }

    const userIds = groups.flatMap((group) =>
      group.publishedBy
        ? [group.createdBy, group.publishedBy]
        : [group.createdBy]
    );
    const userMap = yield* getUserMap(userIds);

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
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const now = yield* Clock.currentTimeMillis;
  yield* validateScheduledStatus(args.status, args.scheduledAt, now);

  const classData = yield* loadActiveClass(args.classId);
  yield* requirePermission(PERMISSIONS.CONTENT_CREATE, {
    classId: args.classId,
    schoolId: classData.schoolId,
    userId,
  });

  const lastGroupOption = yield* reader
    .table("schoolClassMaterialGroups")
    .index(
      "by_classId_and_parentId_and_order",
      (query) => query.eq("classId", args.classId).eq("parentId", undefined),
      "desc"
    )
    .first();
  const lastGroup = Option.getOrNull(lastGroupOption);
  const isScheduled = args.status === "scheduled";
  const isPublished = args.status === "published";
  const groupId = yield* writer.table("schoolClassMaterialGroups").insert({
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
  });

  if (isScheduled && args.scheduledAt !== undefined) {
    const scheduledAt = args.scheduledAt;
    const scheduledJobId = yield* scheduler.runAfter(
      Duration.millis(Math.max(scheduledAt - now, 0)),
      refs.internal.classes.materials.mutations.publishMaterialGroup,
      { groupId, publishedBy: userId }
    );
    yield* writer.table("schoolClassMaterialGroups").patch(groupId, {
      scheduledJobId,
    });
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
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const nextStatus = args.status ?? group.status;
  const nextScheduledAt = args.scheduledAt ?? group.scheduledAt;
  const now = yield* Clock.currentTimeMillis;
  yield* validateScheduledStatus(nextStatus, nextScheduledAt, now);

  const classData = yield* loadActiveClass(group.classId);
  yield* requirePermission(PERMISSIONS.CONTENT_EDIT, {
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

  if (needsCancel) {
    scheduledJobId = undefined;
  }

  if (needsSchedule && nextScheduledAt !== undefined) {
    scheduledJobId = yield* scheduler.runAfter(
      Duration.millis(Math.max(nextScheduledAt - now, 0)),
      refs.internal.classes.materials.mutations.publishMaterialGroup,
      { groupId: args.groupId, publishedBy: userId }
    );
  }

  const isNewlyPublished = willBePublished && !wasPublished;
  yield* writer.table("schoolClassMaterialGroups").patch(args.groupId, {
    description: args.description ?? group.description,
    name: args.name ?? group.name,
    publishedAt: isNewlyPublished ? now : group.publishedAt,
    publishedBy: isNewlyPublished ? userId : group.publishedBy,
    scheduledAt: willBeScheduled ? nextScheduledAt : undefined,
    scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
    status: nextStatus,
    updatedAt: now,
  });

  return args.groupId;
});

/**
 * Publishes a scheduled material group only when the current schedule is due.
 *
 * @see https://confect.dev/server/scheduling
 */
export const publishMaterialGroup = Effect.fn(
  "school.materials.publishMaterialGroup"
)(function* (args: {
  groupId: Id<"schoolClassMaterialGroups">;
  publishedBy: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const group = yield* reader
    .table("schoolClassMaterialGroups")
    .get(args.groupId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  const now = yield* Clock.currentTimeMillis;

  if (
    !group ||
    group.status !== "scheduled" ||
    !group.scheduledAt ||
    group.scheduledAt > now
  ) {
    return null;
  }

  yield* writer.table("schoolClassMaterialGroups").patch(args.groupId, {
    publishedAt: now,
    publishedBy: args.publishedBy,
    scheduledAt: undefined,
    scheduledJobId: undefined,
    status: "published",
    updatedAt: now,
  });

  return null;
});

/** Deletes a material group after permission checks. */
export const deleteMaterialGroup = Effect.fn(
  "school.materials.deleteMaterialGroup"
)(function* (args: { groupId: Id<"schoolClassMaterialGroups"> }) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const classData = yield* loadActiveClass(group.classId);
  yield* requirePermission(PERMISSIONS.CONTENT_DELETE, {
    classId: group.classId,
    schoolId: classData.schoolId,
    userId,
  });

  yield* writer.table("schoolClassMaterialGroups").delete(args.groupId);
  return null;
});

/** Swaps a material group order with the nearest adjacent group. */
export const reorderMaterialGroup = Effect.fn(
  "school.materials.reorderMaterialGroup"
)(function* (args: {
  direction: OrderDirection;
  groupId: Id<"schoolClassMaterialGroups">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const group = yield* loadMaterialGroup(args.groupId);
  const classData = yield* loadActiveClass(group.classId);
  yield* requirePermission(PERMISSIONS.CONTENT_EDIT, {
    classId: group.classId,
    schoolId: classData.schoolId,
    userId,
  });

  const adjacentGroupOption =
    args.direction === "up"
      ? yield* reader
          .table("schoolClassMaterialGroups")
          .index(
            "by_classId_and_parentId_and_order",
            (query) =>
              query
                .eq("classId", group.classId)
                .eq("parentId", group.parentId)
                .lt("order", group.order),
            "desc"
          )
          .first()
      : yield* reader
          .table("schoolClassMaterialGroups")
          .index("by_classId_and_parentId_and_order", (query) =>
            query
              .eq("classId", group.classId)
              .eq("parentId", group.parentId)
              .gt("order", group.order)
          )
          .first();
  const adjacentGroup = Option.getOrNull(adjacentGroupOption);

  if (!adjacentGroup) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.all([
    writer.table("schoolClassMaterialGroups").patch(group._id, {
      order: adjacentGroup.order,
      updatedAt: now,
    }),
    writer.table("schoolClassMaterialGroups").patch(adjacentGroup._id, {
      order: group.order,
      updatedAt: now,
    }),
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
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const classData = yield* loadClass(args.classId);
  const access = yield* requireClassAccess(
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
    const groupsPage = yield* reader
      .table("schoolClassMaterialGroups")
      .search("search_name", (query) => {
        const builder = query
          .search("name", searchQuery)
          .eq("classId", args.classId)
          .eq("parentId", parentId);

        if (canSeeAllStatuses) {
          return builder;
        }

        return builder.eq("status", "published");
      })
      .paginate(args.paginationOpts);
    const page = yield* enrichMaterialGroups(groupsPage.page);

    return { ...groupsPage, page };
  }

  if (canSeeAllStatuses) {
    const groupsPage = yield* reader
      .table("schoolClassMaterialGroups")
      .index("by_classId_and_parentId_and_order", (query) =>
        query.eq("classId", args.classId).eq("parentId", parentId)
      )
      .paginate(args.paginationOpts);
    const page = yield* enrichMaterialGroups(groupsPage.page);

    return { ...groupsPage, page };
  }

  const groupsPage = yield* reader
    .table("schoolClassMaterialGroups")
    .index("by_classId_and_parentId_and_status_and_order", (query) =>
      query
        .eq("classId", args.classId)
        .eq("parentId", parentId)
        .eq("status", "published")
    )
    .paginate(args.paginationOpts);
  const page = yield* enrichMaterialGroups(groupsPage.page);

  return { ...groupsPage, page };
});
