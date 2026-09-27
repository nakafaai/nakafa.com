import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import { enrichMaterialGroups } from "@repo/backend/confect/classes/materials/groups";
import spec from "@repo/backend/confect/classes/materials/queries.spec";
import { isAdmin } from "@repo/backend/confect/schools/membership";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { PaginationResult } from "convex/server";
import { Effect, Layer } from "effect";

/**
 * Get paginated material groups for a class.
 * Returns groups with user data and counts (materialCount, childGroupCount).
 * Role-based: teachers see all statuses, students see only published.
 */
const getMaterialGroups = FunctionImpl.make(
  databaseSchema,
  spec,
  "getMaterialGroups",
  Effect.fn("classes.materials.queries.getMaterialGroups")(function* (args) {
    const database = yield* DatabaseReader;
    const ctx = yield* QueryCtxService;
    const { classId, parentId, q: searchQuery, paginationOpts } = args;
    const user = yield* requireAuth(ctx);
    const currentUserId = user.appUser._id;
    const classData = yield* loadClass(ctx, classId);
    const { classMembership, schoolMembership } = yield* requireClassAccess(
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
        ? yield* database
            .table("schoolClassMaterialGroups")
            .search("search_name", (q) =>
              q
                .search("name", searchQuery)
                .eq("classId", classId)
                .eq("parentId", parentId)
            )
            .paginate(paginationOpts)
            .pipe(Effect.orDie)
        : yield* database
            .table("schoolClassMaterialGroups")
            .search("search_name", (q) =>
              q
                .search("name", searchQuery)
                .eq("classId", classId)
                .eq("parentId", parentId)
                .eq("status", "published")
            )
            .paginate(paginationOpts)
            .pipe(Effect.orDie);
      groupsPage = searchResults;
    } else if (canSeeAllStatuses) {
      groupsPage = yield* database
        .table("schoolClassMaterialGroups")
        .index(
          "by_classId_and_parentId_and_order",
          (q) => q.eq("classId", classId).eq("parentId", parentId),
          "asc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    } else {
      groupsPage = yield* database
        .table("schoolClassMaterialGroups")
        .index(
          "by_classId_and_parentId_and_status_and_order",
          (q) =>
            q
              .eq("classId", classId)
              .eq("parentId", parentId)
              .eq("status", "published"),
          "asc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    const enrichedGroups = yield* enrichMaterialGroups(ctx, groupsPage.page);
    return {
      ...groupsPage,
      page: enrichedGroups,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getMaterialGroups),
  GroupImpl.finalize
);
