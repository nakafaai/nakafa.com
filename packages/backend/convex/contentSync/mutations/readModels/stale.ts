import { internalMutation } from "@repo/backend/convex/functions";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { deleteResultValidator } from "./schema";

/** Deletes stale generated material identity rows in bounded batches. */
export const deleteStaleMaterials = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("materials")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale localized material rows, optionally scoped by locale. */
export const deleteStaleMaterialLocales = internalMutation({
  args: {
    limit: v.number(),
    locale: v.optional(localeValidator),
    syncedAt: v.number(),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const locale = args.locale;
    const staleRows =
      locale === undefined
        ? await ctx.db
            .query("materialLocales")
            .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
            .take(args.limit)
        : await ctx.db
            .query("materialLocales")
            .withIndex("by_locale_and_syncedAt", (q) =>
              q.eq("locale", locale).lt("syncedAt", args.syncedAt)
            )
            .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated curriculum identity rows in bounded batches. */
export const deleteStaleCurricula = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curricula")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated curriculum node rows in bounded batches. */
export const deleteStaleCurriculumNodes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curriculumNodes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated curriculum-to-material mapping rows. */
export const deleteStaleCurriculumMaterials = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curriculumMaterials")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated assessment identity rows in bounded batches. */
export const deleteStaleAssessments = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("assessments")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated assessment node rows in bounded batches. */
export const deleteStaleAssessmentNodes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("assessmentNodes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Deletes stale generated public route rows in bounded batches. */
export const deleteStalePublicRoutes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("publicRoutes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});
