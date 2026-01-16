import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { requireClassAccess } from "@repo/backend/convex/lib/authHelpers";
import {
  getUserMap,
  type UserData,
} from "@repo/backend/convex/lib/userHelpers";
import { ConvexError } from "convex/values";

/**
 * Validate scheduled status has a future scheduledAt timestamp.
 * Checks if scheduledAt is provided and in the future when status is "scheduled".
 *
 * @param status - The material group status (draft, published, scheduled, archived)
 * @param scheduledAt - Optional Unix timestamp in milliseconds for when to publish
 * @throws INVALID_ARGUMENT with message "scheduledAt is required when status is scheduled" if status is scheduled but scheduledAt is missing
 * @throws INVALID_ARGUMENT with message "scheduledAt must be in the future" if status is scheduled but scheduledAt is in the past
 */
export function validateScheduledStatus(
  status: string,
  scheduledAt: number | undefined
) {
  if (status !== "scheduled") {
    return;
  }
  if (!scheduledAt) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt is required when status is scheduled.",
    });
  }
  if (scheduledAt <= Date.now()) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt must be in the future.",
    });
  }
}

/**
 * Load a material group by ID.
 * Fetches a material group from the database and validates it exists.
 *
 * @param ctx - The Convex query or mutation context
 * @param groupId - The ID of the material group to load
 * @returns The material group document
 * @throws ConvexError with code "GROUP_NOT_FOUND" if the group doesn't exist
 */
export async function loadMaterialGroup(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"schoolClassMaterialGroups">
) {
  const group = await ctx.db.get("schoolClassMaterialGroups", groupId);

  if (!group) {
    throw new ConvexError({
      code: "GROUP_NOT_FOUND",
      message: "Material group not found.",
    });
  }

  return group;
}

/**
 * Load material group and verify user has access to its class.
 * Fetches the group and validates the user is a member of the associated class.
 *
 * @param ctx - The Convex query or mutation context
 * @param groupId - The ID of material group to load
 * @param userId - The ID of the user to check access for
 * @returns Object containing the group document and class membership details
 * @throws ConvexError with code "GROUP_NOT_FOUND" if group doesn't exist
 * @throws ConvexError with code "ACCESS_DENIED" if user is not a member of the class
 */
export async function loadMaterialGroupWithAccess(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"schoolClassMaterialGroups">,
  userId: Id<"users">
) {
  const group = await loadMaterialGroup(ctx, groupId);
  const access = await requireClassAccess(
    ctx,
    group.classId,
    group.schoolId,
    userId
  );
  return { group, ...access };
}

/**
 * Material group enriched with user data for display.
 * Includes creator and publisher user information.
 */
export type EnrichedMaterialGroup = Doc<"schoolClassMaterialGroups"> & {
  user: UserData | null;
  publishedByUser: UserData | null;
};

/**
 * Enrich material groups with creator and publisher user data.
 * Fetches users in a single batch query for performance.
 *
 * @param ctx - The Convex query context
 * @param groups - Array of material groups to enrich
 * @returns Array of material groups with user data attached
 */
export async function enrichMaterialGroups(
  ctx: QueryCtx,
  groups: Doc<"schoolClassMaterialGroups">[]
): Promise<EnrichedMaterialGroup[]> {
  if (groups.length === 0) {
    return [];
  }

  const userIds = groups.flatMap((g) =>
    g.publishedBy ? [g.createdBy, g.publishedBy] : [g.createdBy]
  );
  const userMap = await getUserMap(ctx, userIds);

  return groups.map((group) => ({
    ...group,
    user: userMap.get(group.createdBy) ?? null,
    publishedByUser: group.publishedBy
      ? (userMap.get(group.publishedBy) ?? null)
      : null,
  }));
}
