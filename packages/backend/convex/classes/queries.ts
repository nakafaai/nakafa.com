import { query } from "@repo/backend/convex/_generated/server";
import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/convex/classes/constants";
import {
  paginatedClassesValidator,
  paginatedPeopleValidator,
  schoolClassVisibilityValidator,
} from "@repo/backend/convex/classes/schema";
import { loadActiveClass, loadClass } from "@repo/backend/convex/classes/utils";
import {
  type ClassRouteResult,
  classRouteResultValidator,
} from "@repo/backend/convex/classes/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  checkClassAccess,
  requireClassAccess,
} from "@repo/backend/convex/lib/helpers/class";
import {
  getSchoolMembership,
  isAdmin,
} from "@repo/backend/convex/lib/helpers/school";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

const MAX_CLASS_MEMBER_SEARCH_RESULTS = 500;

/**
 * List classes for one school with optional search and visibility filters.
 * Only school members can list classes.
 */
export const getClasses = query({
  args: {
    schoolId: vv.id("schools"),
    q: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    visibility: v.optional(schoolClassVisibilityValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedClassesValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const {
      schoolId,
      q: searchQuery,
      isArchived,
      visibility,
      paginationOpts,
    } = args;
    const schoolMembership = await getSchoolMembership(
      ctx,
      schoolId,
      user.appUser._id
    );

    if (!schoolMembership) {
      throw new ConvexError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to list its classes.",
      });
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      return ctx.db
        .query("schoolClasses")
        .withSearchIndex("search_name", (q) => {
          let builder = q.search("name", searchQuery).eq("schoolId", schoolId);
          if (isArchived !== undefined) {
            builder = builder.eq("isArchived", isArchived);
          }
          if (visibility !== undefined) {
            builder = builder.eq("visibility", visibility);
          }
          return builder;
        })
        .paginate(paginationOpts);
    }

    if (visibility !== undefined && isArchived !== undefined) {
      return ctx.db
        .query("schoolClasses")
        .withIndex("by_schoolId_and_visibility_and_isArchived", (q) =>
          q
            .eq("schoolId", schoolId)
            .eq("visibility", visibility)
            .eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (visibility !== undefined) {
      return ctx.db
        .query("schoolClasses")
        .withIndex("by_schoolId_and_visibility_and_isArchived", (q) =>
          q.eq("schoolId", schoolId).eq("visibility", visibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (isArchived !== undefined) {
      return ctx.db
        .query("schoolClasses")
        .withIndex("by_schoolId_and_isArchived_and_visibility", (q) =>
          q.eq("schoolId", schoolId).eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    return ctx.db
      .query("schoolClasses")
      .withIndex("by_schoolId_and_isArchived_and_visibility", (q) =>
        q.eq("schoolId", schoolId)
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

/**
 * Resolve the full route state for one class page.
 *
 * The class shell needs one stable backend contract so the frontend can render
 * either the joined class experience or the join screen without stitching
 * together multiple client-side queries.
 */
export const getClassRoute = query({
  args: {
    classId: v.string(),
  },
  returns: classRouteResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const classId = ctx.db.normalizeId("schoolClasses", args.classId);

    if (!classId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${args.classId}`,
      });
    }

    const classData = await loadActiveClass(ctx, classId);
    const { classMembership, schoolMembership } = await checkClassAccess(
      ctx,
      classId,
      classData.schoolId,
      user.appUser._id
    );

    if (!schoolMembership) {
      throw new ConvexError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to access this class.",
      });
    }

    if (classMembership || isAdmin(schoolMembership)) {
      const accessibleRoute = {
        kind: "accessible",
        class: classData,
        classMembership,
        schoolMembership,
      } satisfies ClassRouteResult;

      return accessibleRoute;
    }

    const joinRequiredRoute = {
      kind: "joinRequired",
      class: {
        _id: classData._id,
        image: classData.image,
        name: classData.name,
        subject: classData.subject,
        visibility: classData.visibility,
        year: classData.year,
      },
      schoolMembership,
    } satisfies ClassRouteResult;

    return joinRequiredRoute;
  },
});

/**
 * List class members with optional name/email search.
 * Search mode uses a bounded in-memory filter so pagination stays correct.
 */
export const getPeople = query({
  args: {
    classId: vv.id("schoolClasses"),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedPeopleValidator,
  handler: async (ctx, args) => {
    const { classId, q, paginationOpts } = args;

    const user = await requireAuth(ctx);
    const classData = await loadClass(ctx, classId);
    await requireClassAccess(
      ctx,
      classId,
      classData.schoolId,
      user.appUser._id
    );

    const normalizedQuery = q?.trim().toLowerCase();

    if (normalizedQuery) {
      const expectedMemberCount =
        classData.studentCount + classData.teacherCount;
      const boundedMemberCount = Math.min(
        expectedMemberCount,
        MAX_CLASS_MEMBER_SEARCH_RESULTS
      );
      const members = await ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (idx) => idx.eq("classId", classId))
        .take(boundedMemberCount + 1);

      if (expectedMemberCount > MAX_CLASS_MEMBER_SEARCH_RESULTS) {
        throw new ConvexError({
          code: "CLASS_MEMBER_SEARCH_LIMIT_EXCEEDED",
          message: "Class member search exceeds the supported search limit.",
        });
      }

      if (members.length > expectedMemberCount) {
        throw new ConvexError({
          code: "CLASS_MEMBER_COUNT_EXCEEDED",
          message: "Class member count exceeds the class member totals.",
        });
      }

      const userMap = await getUserMap(
        ctx,
        members.map((member) => member.userId)
      );
      const people = members.flatMap((member) => {
        const userData = userMap.get(member.userId);

        if (!userData) {
          return [];
        }

        const matchesQuery =
          userData.name.toLowerCase().includes(normalizedQuery) ||
          userData.email.toLowerCase().includes(normalizedQuery);

        if (!matchesQuery) {
          return [];
        }

        return [{ ...member, user: userData }];
      });

      people.sort((a, b) => {
        if (a.role === "teacher" && b.role === "student") {
          return -1;
        }
        if (a.role === "student" && b.role === "teacher") {
          return 1;
        }
        return 0;
      });

      const cursor = paginationOpts.cursor;
      const startIndex = cursor ? Number(cursor) : 0;

      if (!Number.isInteger(startIndex) || startIndex < 0) {
        throw new ConvexError({
          code: "INVALID_PAGINATION_CURSOR",
          message: "Invalid class people search cursor.",
        });
      }

      const endIndex = Math.min(
        startIndex + paginationOpts.numItems,
        people.length
      );

      return {
        continueCursor: `${endIndex}`,
        isDone: endIndex >= people.length,
        page: people.slice(startIndex, endIndex),
      };
    }

    const membersPage = await ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (idx) => idx.eq("classId", classId))
      .paginate(paginationOpts);

    const userMap = await getUserMap(
      ctx,
      membersPage.page.map((m) => m.userId)
    );

    const people = membersPage.page.flatMap((member) => {
      const userData = userMap.get(member.userId);
      if (!userData) {
        return [];
      }

      return [{ ...member, user: userData }];
    });

    people.sort((a, b) => {
      if (a.role === "teacher" && b.role === "student") {
        return -1;
      }
      if (a.role === "student" && b.role === "teacher") {
        return 1;
      }
      return 0;
    });

    return {
      ...membersPage,
      page: people,
    };
  },
});

/**
 * Return the generated invite codes for a class.
 * Only school admins or class teachers can read them.
 */
export const getInviteCodes = query({
  args: {
    classId: vv.id("schoolClasses"),
  },
  returns: v.array(vv.doc("schoolClassInviteCodes")),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const classData = await loadClass(ctx, args.classId);
    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    if (isAdmin(schoolMembership) || classMembership?.role === "teacher") {
      const inviteCodes = await ctx.db
        .query("schoolClassInviteCodes")
        .withIndex("by_classId_and_role", (idx) =>
          idx.eq("classId", args.classId)
        )
        .take(SCHOOL_CLASS_INVITE_CODE_ROLES.length + 1);

      if (inviteCodes.length > SCHOOL_CLASS_INVITE_CODE_ROLES.length) {
        throw new ConvexError({
          code: "CLASS_INVITE_CODE_LIMIT_EXCEEDED",
          message: "Class invite code count exceeds the supported role count.",
        });
      }

      return inviteCodes;
    }

    throw new ConvexError({
      code: "ACCESS_DENIED",
      message: "Only teachers or school admins can view class invite codes.",
    });
  },
});
