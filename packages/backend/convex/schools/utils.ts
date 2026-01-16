import type { MutationCtx } from "@repo/backend/convex/_generated/server";

/**
 * Generate a unique slug by appending a number if the slug already exists.
 */
export async function generateUniqueSlug(
  ctx: MutationCtx,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("schools")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}
