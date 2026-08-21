import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { isReservedSchoolSlug } from "@repo/backend/convex/schools/slug";

/**
 * Generate a route-safe unique slug, appending a number when required.
 */
export async function generateUniqueSlug(
  ctx: MutationCtx,
  baseSlug: string
): Promise<string> {
  let counter = 0;

  while (true) {
    const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    counter += 1;

    if (isReservedSchoolSlug(slug)) {
      continue;
    }

    const existing = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
    }
  }
}
