import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { checkClassAccess, requireAuth } from "../lib/authHelpers";
import { getUserMap } from "../lib/userHelpers";
import { loadClassWithAccess } from "./utils";

export const getClasses = query({
  args: {
    schoolId: v.id("schools"),
    q: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const {
      schoolId,
      q: searchQuery,
      isArchived,
      visibility,
      paginationOpts,
    } = args;

    if (searchQuery && searchQuery.trim().length > 0) {
      return await ctx.db
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

    if (isArchived !== undefined && visibility !== undefined) {
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived_visibility", (q) =>
          q
            .eq("schoolId", schoolId)
            .eq("isArchived", isArchived)
            .eq("visibility", visibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (isArchived !== undefined) {
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived_visibility", (q) =>
          q.eq("schoolId", schoolId).eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    const result = await ctx.db
      .query("schoolClasses")
      .withIndex("schoolId_isArchived_visibility", (q) =>
        q.eq("schoolId", schoolId)
      )
      .order("desc")
      .paginate(paginationOpts);

    if (visibility !== undefined) {
      return {
        ...result,
        page: result.page.filter((c) => c.visibility === visibility),
      };
    }

    return result;
  },
});

export const getClassInfo = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const classData = await ctx.db.get("schoolClasses", args.classId);

    if (!classData) {
      return null;
    }

    return {
      name: classData.name,
      subject: classData.subject,
      year: classData.year,
      image: classData.image,
      visibility: classData.visibility,
    };
  },
});

export const verifyClassMembership = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const classData = await ctx.db.get("schoolClasses", args.classId);
    if (!classData) {
      return { allow: false };
    }

    const { hasAccess, schoolMembership } = await checkClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    return { allow: hasAccess && !!schoolMembership };
  },
});

export const getClass = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const { classData, classMembership, schoolMembership } =
      await loadClassWithAccess(ctx, args.classId, user.appUser._id);

    return {
      class: classData,
      classMembership,
      schoolMembership,
    };
  },
});

export const getPeople = query({
  args: {
    classId: v.id("schoolClasses"),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { classId, q, paginationOpts } = args;

    const user = await requireAuth(ctx);
    await loadClassWithAccess(ctx, classId, user.appUser._id);

    const membersPage = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (idx) => idx.eq("classId", classId))
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

      if (q && q.trim().length > 0) {
        const searchLower = q.toLowerCase().trim();
        const matches =
          userData.name.toLowerCase().includes(searchLower) ||
          userData.email.toLowerCase().includes(searchLower);
        if (!matches) {
          return [];
        }
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

export const getInviteCodes = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await loadClassWithAccess(ctx, args.classId, user.appUser._id);

    return await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("classId_role", (idx) => idx.eq("classId", args.classId))
      .collect();
  },
});
