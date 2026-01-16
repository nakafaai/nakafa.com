import { internal } from "@repo/backend/convex/_generated/api";
import {
  loadMaterialGroup,
  validateScheduledStatus,
} from "@repo/backend/convex/classes/materials/utils";
import { schoolClassMaterialStatus } from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/authHelpers";
import {
  PERMISSIONS,
  requirePermission,
} from "@repo/backend/convex/lib/permissions";
import { v } from "convex/values";

export const createMaterialGroup = mutation({
  args: {
    classId: v.id("schoolClasses"),
    name: v.string(),
    description: v.string(),
    status: schoolClassMaterialStatus,
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    validateScheduledStatus(args.status, args.scheduledAt);

    const classData = await loadActiveClass(ctx, args.classId);

    await requirePermission(ctx, PERMISSIONS.CONTENT_CREATE, {
      userId,
      classId: args.classId,
      schoolId: classData.schoolId,
    });

    // Get next order using index (efficient: uses .first() not .collect())
    const lastGroup = await ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("classId_parentId_order", (q) =>
        q.eq("classId", args.classId).eq("parentId", undefined)
      )
      .order("desc")
      .first();

    const order = (lastGroup?.order ?? -1) + 1;
    const now = Date.now();
    const isScheduled = args.status === "scheduled";
    const isPublished = args.status === "published";

    const groupId = await ctx.db.insert("schoolClassMaterialGroups", {
      classId: args.classId,
      schoolId: classData.schoolId,
      name: args.name,
      description: args.description,
      order,
      status: args.status,
      scheduledAt: isScheduled ? args.scheduledAt : undefined,
      // Set publishedAt/publishedBy immediately when creating as "published"
      publishedAt: isPublished ? now : undefined,
      publishedBy: isPublished ? userId : undefined,
      materialCount: 0,
      childGroupCount: 0,
      createdBy: userId,
      updatedAt: now,
    });

    // Schedule publish job if needed (requires groupId, so separate patch)
    if (isScheduled && args.scheduledAt) {
      const scheduledJobId = await ctx.scheduler.runAfter(
        Math.max(args.scheduledAt - now, 0),
        internal.classes.materials.mutations.publishMaterialGroup,
        { groupId, publishedBy: userId }
      );
      await ctx.db.patch("schoolClassMaterialGroups", groupId, {
        scheduledJobId,
      });
    }

    return groupId;
  },
});

export const updateMaterialGroup = mutation({
  args: {
    groupId: v.id("schoolClassMaterialGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(schoolClassMaterialStatus),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    const group = await loadMaterialGroup(ctx, args.groupId);

    const newStatus = args.status ?? group.status;
    const newScheduledAt = args.scheduledAt ?? group.scheduledAt;

    validateScheduledStatus(newStatus, newScheduledAt);

    const classData = await loadActiveClass(ctx, group.classId);

    await requirePermission(ctx, PERMISSIONS.CONTENT_EDIT, {
      userId,
      classId: group.classId,
      schoolId: classData.schoolId,
    });

    const now = Date.now();
    const wasPublished = group.status === "published";
    const willBePublished = newStatus === "published";
    const wasScheduled = group.status === "scheduled";
    const willBeScheduled = newStatus === "scheduled";
    const timeChanged = newScheduledAt !== group.scheduledAt;

    // Determine scheduling changes
    const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
    const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);

    let scheduledJobId = group.scheduledJobId;

    // Cancel existing job if status changed or time changed
    if (needsCancel && group.scheduledJobId) {
      await ctx.scheduler.cancel(group.scheduledJobId);
      scheduledJobId = undefined;
    }

    // Schedule new job if needed
    if (needsSchedule && newScheduledAt) {
      scheduledJobId = await ctx.scheduler.runAfter(
        Math.max(newScheduledAt - now, 0),
        internal.classes.materials.mutations.publishMaterialGroup,
        { groupId: args.groupId, publishedBy: userId }
      );
    }

    // Determine published fields
    const isNewlyPublished = willBePublished && !wasPublished;

    await ctx.db.patch("schoolClassMaterialGroups", args.groupId, {
      name: args.name ?? group.name,
      description: args.description ?? group.description,
      status: newStatus,
      scheduledAt: willBeScheduled ? newScheduledAt : undefined,
      scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
      // Set publishedAt/publishedBy when changing to "published"
      publishedAt: isNewlyPublished ? now : group.publishedAt,
      publishedBy: isNewlyPublished ? userId : group.publishedBy,
      updatedAt: now,
    });

    return args.groupId;
  },
});

export const publishMaterialGroup = internalMutation({
  args: {
    groupId: v.id("schoolClassMaterialGroups"),
    publishedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get("schoolClassMaterialGroups", args.groupId);

    if (!group || group.status !== "scheduled") {
      return;
    }

    const now = Date.now();

    await ctx.db.patch("schoolClassMaterialGroups", args.groupId, {
      status: "published",
      scheduledJobId: undefined,
      publishedAt: now,
      publishedBy: args.publishedBy,
      updatedAt: now,
    });
  },
});

export const deleteMaterialGroup = mutation({
  args: {
    groupId: v.id("schoolClassMaterialGroups"),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    const group = await loadMaterialGroup(ctx, args.groupId);

    const classData = await loadActiveClass(ctx, group.classId);

    await requirePermission(ctx, PERMISSIONS.CONTENT_DELETE, {
      userId,
      classId: group.classId,
      schoolId: classData.schoolId,
    });

    // Delete triggers cascade: children, materials, attachments, views, parent count
    await ctx.db.delete("schoolClassMaterialGroups", args.groupId);
  },
});

export const reorderMaterialGroup = mutation({
  args: {
    groupId: v.id("schoolClassMaterialGroups"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    const group = await loadMaterialGroup(ctx, args.groupId);

    const classData = await loadActiveClass(ctx, group.classId);

    await requirePermission(ctx, PERMISSIONS.CONTENT_EDIT, {
      userId,
      classId: group.classId,
      schoolId: classData.schoolId,
    });

    // Find adjacent group to swap with using index range query
    const adjacentGroup =
      args.direction === "up"
        ? await ctx.db
            .query("schoolClassMaterialGroups")
            .withIndex("classId_parentId_order", (q) =>
              q
                .eq("classId", group.classId)
                .eq("parentId", group.parentId)
                .lt("order", group.order)
            )
            .order("desc")
            .first()
        : await ctx.db
            .query("schoolClassMaterialGroups")
            .withIndex("classId_parentId_order", (q) =>
              q
                .eq("classId", group.classId)
                .eq("parentId", group.parentId)
                .gt("order", group.order)
            )
            .order("asc")
            .first();

    if (!adjacentGroup) {
      // Already at the edge, nothing to do
      return;
    }

    // Swap orders
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("schoolClassMaterialGroups", group._id, {
        order: adjacentGroup.order,
        updatedAt: now,
      }),
      ctx.db.patch("schoolClassMaterialGroups", adjacentGroup._id, {
        order: group.order,
        updatedAt: now,
      }),
    ]);
  },
});
