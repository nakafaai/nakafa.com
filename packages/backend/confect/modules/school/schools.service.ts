import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import type { PaginationOptions } from "convex/server";
import { Clock, Effect, Schema } from "effect";
import { nanoid } from "nanoid";

const SCHOOL_INVITE_ROLES = ["teacher", "student", "parent", "demo"] as const;

export class SchoolActionError extends Schema.TaggedError<SchoolActionError>()(
  "SchoolActionError",
  { message: Schema.String }
) {}

/** Converts a school name into a URL-safe slug base. */
function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generates a short random invite code. */
function generateInviteCode() {
  return nanoid(10);
}

/** Finds a unique school slug for a desired base slug. */
const generateUniqueSlug = Effect.fn("schools.generateUniqueSlug")(function* (
  baseSlug: string
) {
  const ctx = yield* MutationCtx;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("schools")
        .withIndex("by_slug", (query) => query.eq("slug", slug))
        .first()
    );

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
});

/** Fails when an invite code cannot currently be used. */
function validateInviteCodeState(
  inviteCode: Doc<"schoolInviteCodes">,
  now: number
) {
  if (!inviteCode.enabled) {
    return Effect.fail(
      new SchoolActionError({
        message: "This invite code has been disabled.",
      })
    );
  }

  if (inviteCode.expiresAt && inviteCode.expiresAt < now) {
    return Effect.fail(
      new SchoolActionError({ message: "This invite code has expired." })
    );
  }

  if (inviteCode.maxUsage && inviteCode.currentUsage >= inviteCode.maxUsage) {
    return Effect.fail(
      new SchoolActionError({
        message: "This invite code has reached its usage limit.",
      })
    );
  }

  return Effect.succeed(inviteCode);
}

/** Fails when the user is already an active member. */
function validateNotExistingMembership(
  membership: Doc<"schoolMembers"> | null
) {
  if (!membership) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new SchoolActionError({
      message: "You are already a member of this school.",
    })
  );
}

/** Reads the active membership for a school/user pair. */
export function getSchoolMembership(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return ctx.db
    .query("schoolMembers")
    .withIndex("by_schoolId_and_userId_and_status", (query) =>
      query.eq("schoolId", schoolId).eq("userId", userId).eq("status", "active")
    )
    .unique();
}

/** Creates a school and admin membership for the current user. */
export const createSchool = Effect.fn("schools.createSchool")(function* (args: {
  address: string;
  city: string;
  email: string;
  name: string;
  phone: string;
  province: string;
  type:
    | "elementary-school"
    | "middle-school"
    | "high-school"
    | "vocational-school"
    | "university"
    | "other";
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const existingSchoolByEmail = yield* Effect.promise(() =>
    ctx.db
      .query("schools")
      .withIndex("by_email", (query) => query.eq("email", args.email))
      .unique()
  );

  if (existingSchoolByEmail) {
    return yield* Effect.fail(
      new SchoolActionError({
        message: "A school with this email already exists.",
      })
    );
  }

  const uniqueSlug = yield* generateUniqueSlug(slugify(args.name));
  const now = yield* Clock.currentTimeMillis;
  const userId = user.appUser._id;
  const schoolId = yield* Effect.promise(() =>
    ctx.db.insert("schools", {
      address: args.address,
      city: args.city,
      createdBy: userId,
      currentStudents: 0,
      currentTeachers: 0,
      email: args.email,
      name: args.name,
      phone: args.phone,
      province: args.province,
      slug: uniqueSlug,
      type: args.type,
      updatedAt: now,
      updatedBy: userId,
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("schoolMembers", {
      joinedAt: now,
      role: "admin",
      schoolId,
      status: "active",
      updatedAt: now,
      userId,
    })
  );

  for (const role of SCHOOL_INVITE_ROLES) {
    yield* Effect.promise(() =>
      ctx.db.insert("schoolInviteCodes", {
        code: generateInviteCode(),
        createdBy: userId,
        currentUsage: 0,
        enabled: true,
        role,
        schoolId,
        updatedAt: now,
        updatedBy: userId,
      })
    );
  }

  return { schoolId, slug: uniqueSlug };
});

/** Joins the current user to a school via invite code. */
export const joinSchool = Effect.fn("schools.joinSchool")(function* (args: {
  code: string;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const inviteCode = yield* Effect.promise(() =>
    ctx.db
      .query("schoolInviteCodes")
      .withIndex("by_code", (query) => query.eq("code", args.code))
      .unique()
  );

  if (!inviteCode) {
    return yield* Effect.fail(
      new SchoolActionError({ message: "Invalid invite code." })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  yield* validateInviteCodeState(inviteCode, now);

  const school = yield* Effect.promise(() => ctx.db.get(inviteCode.schoolId));

  if (!school) {
    return yield* Effect.fail(
      new SchoolActionError({ message: "School not found." })
    );
  }

  const existingMember = yield* Effect.promise(() =>
    ctx.db
      .query("schoolMembers")
      .withIndex("by_schoolId_and_userId_and_status", (query) =>
        query
          .eq("schoolId", school._id)
          .eq("userId", user.appUser._id)
          .eq("status", "active")
      )
      .unique()
  );
  yield* validateNotExistingMembership(existingMember);

  yield* Effect.promise(() =>
    ctx.db.insert("schoolMembers", {
      inviteCodeId: inviteCode._id,
      joinedAt: now,
      role: inviteCode.role,
      schoolId: school._id,
      status: "active",
      updatedAt: now,
      userId: user.appUser._id,
    })
  );

  return { schoolId: school._id, slug: school.slug };
});

/** Reads a school and the current user's active membership by slug. */
export const getSchoolBySlug = Effect.fn("schools.getSchoolBySlug")(
  function* (args: { slug: string }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    const school = yield* Effect.promise(() =>
      ctx.db
        .query("schools")
        .withIndex("by_slug", (query) => query.eq("slug", args.slug))
        .unique()
    );

    if (!school) {
      return yield* Effect.fail(
        new SchoolActionError({
          message: `School not found for slug: ${args.slug}`,
        })
      );
    }

    const membership = yield* Effect.promise(() =>
      getSchoolMembership(ctx, school._id, user.appUser._id)
    );

    if (!membership) {
      return yield* Effect.fail(
        new SchoolActionError({
          message: `Membership not found for schoolId: ${school._id} and userId: ${user.appUser._id}`,
        })
      );
    }

    return { membership, school };
  }
);

/** Returns the current user's school landing routing state. */
export const getMySchoolLandingState = Effect.fn(
  "schools.getMySchoolLandingState"
)(function* () {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const memberships = yield* Effect.promise(() =>
    ctx.db
      .query("schoolMembers")
      .withIndex("by_userId_and_status", (query) =>
        query.eq("userId", user.appUser._id).eq("status", "active")
      )
      .take(2)
  );

  if (memberships.length === 0) {
    return { kind: "none" as const };
  }

  if (memberships.length > 1) {
    return { kind: "multiple" as const };
  }

  const membership = memberships[0];
  const school = yield* Effect.promise(() => ctx.db.get(membership.schoolId));

  if (!school) {
    return yield* Effect.fail(
      new SchoolActionError({
        message: `School not found for schoolId: ${membership.schoolId}`,
      })
    );
  }

  return { kind: "single" as const, slug: school.slug };
});

/** Lists the current user's active schools. */
export const getMySchoolsPage = Effect.fn("schools.getMySchoolsPage")(
  function* (args: { paginationOpts: PaginationOptions }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    const memberships = yield* Effect.promise(() =>
      ctx.db
        .query("schoolMembers")
        .withIndex("by_userId_and_status", (query) =>
          query.eq("userId", user.appUser._id).eq("status", "active")
        )
        .paginate(args.paginationOpts)
    );
    const schoolPage = yield* Effect.forEach(memberships.page, (membership) =>
      Effect.gen(function* () {
        const school = yield* Effect.promise(() =>
          ctx.db.get(membership.schoolId)
        );

        if (!school) {
          return null;
        }

        return {
          _id: school._id,
          name: school.name,
          slug: school.slug,
          type: school.type,
        };
      })
    );
    const page = schoolPage.filter((school) => school !== null);

    return { ...memberships, page };
  }
);
