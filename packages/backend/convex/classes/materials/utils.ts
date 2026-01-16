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
 * @throws INVALID_ARGUMENT if scheduledAt is missing or in the past.
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
 * @throws GROUP_NOT_FOUND if group doesn't exist.
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
 * Returns group with membership info.
 * @throws GROUP_NOT_FOUND or ACCESS_DENIED.
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

export type EnrichedMaterialGroup = Doc<"schoolClassMaterialGroups"> & {
  user: UserData | null;
  publishedByUser: UserData | null;
};

/**
 * Enrich material groups with creator and publisher user data.
 * Fetches users in a single batch query for performance.
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
