import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { enrichMaterialGroups } from "@repo/backend/convex/classes/materials/utils";
import { loadClass } from "@repo/backend/convex/classes/utils";
import {
  isAdmin,
  requireAuth,
  requireClassAccess,
} from "@repo/backend/convex/lib/authHelpers";
import type { PaginationResult } from "convex/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

/**
 * Get paginated material groups for a class.
 * Returns groups with user data and counts (materialCount, childGroupCount).
 * Role-based: teachers see all statuses, students see only published.
 */
export const getMaterialGroups = query({
  args: {
    classId: v.id("schoolClasses"),
    parentId: v.optional(v.id("schoolClassMaterialGroups")),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { classId, parentId, q: searchQuery, paginationOpts } = args;

    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    const classData = await loadClass(ctx, classId);
    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      classId,
      classData.schoolId,
      currentUserId
    );

    const isAdminSchool = isAdmin(schoolMembership);
    const isTeacher = classMembership?.role === "teacher";
    const canSeeAllStatuses = isTeacher || isAdminSchool;

    let groupsPage: PaginationResult<Doc<"schoolClassMaterialGroups">>;

    if (searchQuery && searchQuery.trim().length > 0) {
      const searchResults = canSeeAllStatuses
        ? await ctx.db
            .query("schoolClassMaterialGroups")
            .withSearchIndex("search_name", (q) =>
              q.search("name", searchQuery).eq("classId", classId)
            )
            .paginate(paginationOpts)
        : await ctx.db
            .query("schoolClassMaterialGroups")
            .withSearchIndex("search_name", (q) =>
              q
                .search("name", searchQuery)
                .eq("classId", classId)
                .eq("status", "published")
            )
            .paginate(paginationOpts);

      const filteredPage = searchResults.page.filter(
        (group) => group.parentId === parentId
      );

      groupsPage = {
        ...searchResults,
        page: filteredPage,
      };
    } else if (canSeeAllStatuses) {
      groupsPage = await ctx.db
        .query("schoolClassMaterialGroups")
        .withIndex("classId_parentId_order", (q) =>
          q.eq("classId", classId).eq("parentId", parentId)
        )
        .order("asc")
        .paginate(paginationOpts);
    } else {
      groupsPage = await ctx.db
        .query("schoolClassMaterialGroups")
        .withIndex("classId_parentId_status_order", (q) =>
          q
            .eq("classId", classId)
            .eq("parentId", parentId)
            .eq("status", "published")
        )
        .order("asc")
        .paginate(paginationOpts);
    }

    const enrichedGroups = await enrichMaterialGroups(ctx, groupsPage.page);

    return {
      ...groupsPage,
      page: enrichedGroups,
    };
  },
});
