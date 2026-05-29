import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { SchoolActionError } from "@repo/backend/confect/modules/school/schoolErrors";
import type { SchoolType } from "@repo/backend/confect/modules/school/schools.tables";
import type { PaginationOptions } from "convex/server";
import { Clock, Effect, Option } from "effect";
import { nanoid } from "nanoid";

const SCHOOL_INVITE_ROLES = ["teacher", "student", "parent", "demo"] as const;

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
const generateUniqueSlug = Effect.fnUntraced(function* (baseSlug: string) {
  const reader = yield* DatabaseReader;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = yield* reader
      .table("schools")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first();

    if (Option.isNone(existing)) {
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
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return Effect.gen(function* () {
    const reader = yield* DatabaseReader;

    return yield* reader
      .table("schoolMembers")
      .index("by_schoolId_and_userId_and_status", (query) =>
        query
          .eq("schoolId", schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
  });
}

/** Creates a school and admin membership for the current user. */
export const createSchool = Effect.fnUntraced(function* (args: {
  address: string;
  city: string;
  email: string;
  name: string;
  phone: string;
  province: string;
  type: SchoolType;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const existingSchoolByEmail = yield* reader
    .table("schools")
    .get("by_email", args.email)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

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
  const schoolId = yield* writer.table("schools").insert({
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
  });

  yield* writer.table("schoolMembers").insert({
    joinedAt: now,
    role: "admin",
    schoolId,
    status: "active",
    updatedAt: now,
    userId,
  });

  for (const role of SCHOOL_INVITE_ROLES) {
    yield* writer.table("schoolInviteCodes").insert({
      code: generateInviteCode(),
      createdBy: userId,
      currentUsage: 0,
      enabled: true,
      role,
      schoolId,
      updatedAt: now,
      updatedBy: userId,
    });
  }

  return { schoolId, slug: uniqueSlug };
});

/** Joins the current user to a school via invite code. */
export const joinSchool = Effect.fnUntraced(function* (args: { code: string }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const inviteCode = yield* reader
    .table("schoolInviteCodes")
    .get("by_code", args.code)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!inviteCode) {
    return yield* Effect.fail(
      new SchoolActionError({ message: "Invalid invite code." })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  yield* validateInviteCodeState(inviteCode, now);

  const school = yield* reader
    .table("schools")
    .get(inviteCode.schoolId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!school) {
    return yield* Effect.fail(
      new SchoolActionError({ message: "School not found." })
    );
  }

  const existingMember = yield* getSchoolMembership(
    school._id,
    user.appUser._id
  );
  yield* validateNotExistingMembership(existingMember);

  yield* writer.table("schoolMembers").insert({
    inviteCodeId: inviteCode._id,
    joinedAt: now,
    role: inviteCode.role,
    schoolId: school._id,
    status: "active",
    updatedAt: now,
    userId: user.appUser._id,
  });

  return { schoolId: school._id, slug: school.slug };
});

/** Reads a school and the current user's active membership by slug. */
export const getSchoolBySlug = Effect.fnUntraced(function* (args: {
  slug: string;
}) {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const school = yield* reader
    .table("schools")
    .get("by_slug", args.slug)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!school) {
    return yield* Effect.fail(
      new SchoolActionError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for slug: ${args.slug}`,
      })
    );
  }

  const membership = yield* getSchoolMembership(school._id, user.appUser._id);

  if (!membership) {
    return yield* Effect.fail(
      new SchoolActionError({
        code: "MEMBERSHIP_NOT_FOUND",
        message: `Membership not found for schoolId: ${school._id} and userId: ${user.appUser._id}`,
      })
    );
  }

  return { membership, school };
});

/** Returns the current user's school landing routing state. */
export const getMySchoolLandingState = Effect.fnUntraced(function* () {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const memberships = yield* reader
    .table("schoolMembers")
    .index("by_userId_and_status", (query) =>
      query.eq("userId", user.appUser._id).eq("status", "active")
    )
    .take(2);

  if (memberships.length === 0) {
    return { kind: "none" as const };
  }

  if (memberships.length > 1) {
    return { kind: "multiple" as const };
  }

  const membership = memberships[0];
  const school = yield* reader
    .table("schools")
    .get(membership.schoolId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
export const getMySchoolsPage = Effect.fnUntraced(function* (args: {
  paginationOpts: PaginationOptions;
}) {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const memberships = yield* reader
    .table("schoolMembers")
    .index("by_userId_and_status", (query) =>
      query.eq("userId", user.appUser._id).eq("status", "active")
    )
    .paginate(args.paginationOpts);
  const schoolPage = yield* Effect.forEach(memberships.page, (membership) =>
    Effect.gen(function* () {
      const school = yield* reader
        .table("schools")
        .get(membership.schoolId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
});
