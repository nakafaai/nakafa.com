import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { getSchoolMembership } from "@repo/backend/convex/lib/helpers/school";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";
import {
  mySchoolsPageArgs,
  mySchoolsPageResultValidator,
  schoolBySlugResultValidator,
  schoolLandingStateResultValidator,
} from "./validators";

/** Return the authenticated school route snapshot resolved from one slug. */
export const getSchoolBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: schoolBySlugResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const school = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for slug: ${args.slug}`,
      });
    }

    const membership = await getSchoolMembership(
      ctx,
      school._id,
      user.appUser._id
    );

    if (!membership) {
      throw new ConvexError({
        code: "MEMBERSHIP_NOT_FOUND",
        message: `Membership not found for schoolId: ${school._id} and userId: ${user.appUser._id}`,
      });
    }

    return {
      school,
      membership,
    };
  },
});

/**
 * Get the current user's school landing state for the public school entry route.
 */
export const getMySchoolLandingState = query({
  args: {},
  returns: schoolLandingStateResultValidator,
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const memberships = await ctx.db
      .query("schoolMembers")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .take(2);

    if (memberships.length === 0) {
      return { kind: "none" as const };
    }

    if (memberships.length > 1) {
      return { kind: "multiple" as const };
    }

    const school = await ctx.db.get("schools", memberships[0].schoolId);

    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for schoolId: ${memberships[0].schoolId}`,
      });
    }

    return {
      kind: "single" as const,
      slug: school.slug,
    };
  },
});

/** Get the current user's schools as a paginated list of summaries. */
export const getMySchoolsPage = query({
  args: mySchoolsPageArgs,
  returns: mySchoolsPageResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const memberships = await ctx.db
      .query("schoolMembers")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .paginate(args.paginationOpts);

    const schools = await getAll(
      ctx.db,
      memberships.page.map((membership) => membership.schoolId)
    );

    return {
      ...memberships,
      page: schools.flatMap((school) => {
        if (!school) {
          return [];
        }

        return [
          {
            _id: school._id,
            name: school.name,
            slug: school.slug,
            type: school.type,
          },
        ];
      }),
    };
  },
});
