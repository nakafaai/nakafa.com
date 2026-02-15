import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for contentViews table inserts.
 *
 * Updates popularity counts for articles, subjects, and exercises.
 * Only executes on insert operations.
 */
export async function contentViewsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "contentViews">
) {
  switch (change.operation) {
    case "insert": {
      const view = change.newDoc;
      const contentRef = view.contentRef;
      const now = Date.now();

      switch (contentRef.type) {
        case "article": {
          const existing = await ctx.db
            .query("articlePopularity")
            .withIndex("by_contentId", (q) => q.eq("contentId", contentRef.id))
            .first();

          if (existing) {
            await ctx.db.patch(existing._id, {
              viewCount: existing.viewCount + 1,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("articlePopularity", {
              contentId: contentRef.id,
              viewCount: 1,
              updatedAt: now,
            });
          }
          break;
        }

        case "subject": {
          const existing = await ctx.db
            .query("subjectPopularity")
            .withIndex("by_contentId", (q) => q.eq("contentId", contentRef.id))
            .first();

          if (existing) {
            await ctx.db.patch(existing._id, {
              viewCount: existing.viewCount + 1,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("subjectPopularity", {
              contentId: contentRef.id,
              viewCount: 1,
              updatedAt: now,
            });
          }
          break;
        }

        case "exercise": {
          const existing = await ctx.db
            .query("exercisePopularity")
            .withIndex("by_contentId", (q) => q.eq("contentId", contentRef.id))
            .first();

          if (existing) {
            await ctx.db.patch(existing._id, {
              viewCount: existing.viewCount + 1,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("exercisePopularity", {
              contentId: contentRef.id,
              viewCount: 1,
              updatedAt: now,
            });
          }
          break;
        }

        default: {
          break;
        }
      }
      break;
    }

    default: {
      break;
    }
  }
}
