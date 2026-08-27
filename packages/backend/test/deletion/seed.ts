import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

/** Inserts one app user with optional deletion state. */
export function seedDeletionUser(
  ctx: MutationCtx,
  authId: string,
  state: {
    readonly deletedAt?: number;
    readonly deletionPreparedAt?: number;
  } = {}
) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    email: `${authId}@example.com`,
    name: authId,
    plan: "free",
    ...state,
  });
}

/** Inserts one school owned by the test user. */
export function seedDeletionSchool(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  slug: string,
  now: number
) {
  return ctx.db.insert("schools", {
    city: "Jakarta",
    createdBy: ownerId,
    currentStudents: 0,
    currentTeachers: 0,
    email: `${slug}@example.com`,
    name: slug,
    province: "DKI Jakarta",
    slug,
    type: "high-school",
    updatedAt: now,
  });
}

/** Inserts one active school membership. */
export function seedDeletionMember(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">,
  now: number,
  role: Doc<"schoolMembers">["role"] = "student"
) {
  return ctx.db.insert("schoolMembers", {
    joinedAt: now,
    role,
    schoolId,
    status: "active",
    updatedAt: now,
    userId,
  });
}
