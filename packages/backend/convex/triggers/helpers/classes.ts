import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/convex/_generated/server";

/**
 * Update denormalized class member counts
 */
export async function updateClassMemberCount(
  ctx: { db: DatabaseReader & DatabaseWriter },
  classId: Id<"schoolClasses">,
  role: "teacher" | "student",
  delta: number
) {
  const classDoc = await ctx.db.get("schoolClasses", classId);
  if (!classDoc) {
    return;
  }

  if (role === "teacher") {
    await ctx.db.patch("schoolClasses", classId, {
      teacherCount: Math.max(classDoc.teacherCount + delta, 0),
    });
  } else if (role === "student") {
    await ctx.db.patch("schoolClasses", classId, {
      studentCount: Math.max(classDoc.studentCount + delta, 0),
    });
  }
}

/**
 * Handle class member role changes and log activity
 */
export async function handleRoleChange(
  ctx: { db: DatabaseReader & DatabaseWriter },
  memberId: Id<"schoolClassMembers">,
  member: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    userId: Id<"users">;
    role: "teacher" | "student";
  },
  oldMember: { role: "teacher" | "student" }
) {
  const classDoc = await ctx.db.get("schoolClasses", member.classId);
  if (classDoc) {
    let teacherDelta = 0;
    let studentDelta = 0;

    if (oldMember.role === "teacher" && member.role === "student") {
      teacherDelta = -1;
      studentDelta = 1;
    } else if (oldMember.role === "student" && member.role === "teacher") {
      teacherDelta = 1;
      studentDelta = -1;
    }

    await ctx.db.patch("schoolClasses", member.classId, {
      teacherCount: Math.max(classDoc.teacherCount + teacherDelta, 0),
      studentCount: Math.max(classDoc.studentCount + studentDelta, 0),
    });
  }

  await ctx.db.insert("schoolActivityLogs", {
    schoolId: member.schoolId,
    userId: member.userId,
    action: "class_member_role_changed",
    entityType: "classMembers",
    entityId: memberId,
    metadata: {
      classId: member.classId,
      oldRole: oldMember.role,
      newRole: member.role,
    },
  });
}
