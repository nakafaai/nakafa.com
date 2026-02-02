import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  getUserMap,
  type UserData,
} from "@repo/backend/convex/lib/helpers/user";
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
): Promise<
  Array<
    Doc<"schoolClassMaterialGroups"> & {
      user: UserData | null;
      publishedByUser: UserData | null;
    }
  >
> {
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
