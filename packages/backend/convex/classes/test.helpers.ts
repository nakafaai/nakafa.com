import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

/** Insert one school row with the minimum fields required by the schema. */
export async function insertSchool(
  ctx: MutationCtx,
  {
    now,
    userId,
    email = `${userId}@example.com`,
    slug = `nakafa-${userId}`,
  }: {
    now: number;
    userId: Id<"users">;
    email?: string;
    slug?: string;
  }
) {
  return await ctx.db.insert("schools", {
    city: "Jakarta",
    createdBy: userId,
    currentStudents: 0,
    currentTeachers: 0,
    email,
    name: "Nakafa School",
    province: "DKI Jakarta",
    slug,
    type: "high-school",
    updatedAt: now,
    updatedBy: userId,
  });
}

/** Insert one class row with the minimum fields required by the schema. */
export async function insertClass(
  ctx: MutationCtx,
  {
    now,
    schoolId,
    userId,
  }: {
    now: number;
    schoolId: Id<"schools">;
    userId: Id<"users">;
  }
) {
  return await ctx.db.insert("schoolClasses", {
    createdBy: userId,
    image: "retro",
    isArchived: false,
    name: "Class 10A",
    schoolId,
    studentCount: 0,
    subject: "Mathematics",
    teacherCount: 0,
    updatedAt: now,
    updatedBy: userId,
    visibility: "public",
    year: "2026/2027",
  });
}

/** Insert one active school membership for the given user. */
export async function insertSchoolMembership(
  ctx: MutationCtx,
  {
    now,
    role,
    schoolId,
    userId,
  }: {
    now: number;
    role: "admin" | "student" | "teacher";
    schoolId: Id<"schools">;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolMembers", {
    joinedAt: now,
    role,
    schoolId,
    status: "active",
    updatedAt: now,
    userId,
  });
}

/** Insert one active class membership for the given user. */
export async function insertClassMembership(
  ctx: MutationCtx,
  {
    now,
    role,
    classId,
    schoolId,
    userId,
  }: {
    now: number;
    role: "student" | "teacher";
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolClassMembers", {
    classId,
    role,
    schoolId,
    ...(role === "teacher" ? { teacherRole: "primary" as const } : {}),
    updatedAt: now,
    userId,
  });
}
