import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

/**
 * Load a class by ID.
 * @throws CLASS_NOT_FOUND if class doesn't exist.
 */
export async function loadClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await ctx.db.get("schoolClasses", classId);

  if (!classData) {
    throw new ConvexError({
      code: "CLASS_NOT_FOUND",
      message: "Class not found.",
    });
  }

  return classData;
}

/**
 * Load a class and validate it's not archived.
 * @throws CLASS_NOT_FOUND or CLASS_ARCHIVED.
 */
export async function loadActiveClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await loadClass(ctx, classId);

  if (classData.isArchived) {
    throw new ConvexError({
      code: "CLASS_ARCHIVED",
      message: "Cannot modify an archived class.",
    });
  }

  return classData;
}
