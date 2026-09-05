import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

/** Creates an authenticated class owner, school member, and unrelated user. */
export async function createClassFixture() {
  const now = Date.UTC(2026, 8, 1);
  const t = createConvexTestWithBetterAuth();
  const users = await t.mutation(async (ctx) => ({
    admin: await seedAuthenticatedUser(ctx, { now, suffix: "class-admin" }),
    student: await seedAuthenticatedUser(ctx, { now, suffix: "class-student" }),
    outsider: await seedAuthenticatedUser(ctx, {
      now,
      suffix: "class-outsider",
    }),
  }));
  const admin = t.withIdentity({
    sessionId: users.admin.sessionId,
    subject: users.admin.authUserId,
  });
  const student = t.withIdentity({
    sessionId: users.student.sessionId,
    subject: users.student.authUserId,
  });
  const outsider = t.withIdentity({
    sessionId: users.outsider.sessionId,
    subject: users.outsider.authUserId,
  });
  const { schoolId } = await admin.mutation(
    api.schools.mutations.createSchool,
    {
      address: "Jl. Merdeka 1",
      city: "Jakarta",
      email: "class-school@example.com",
      name: "Class School",
      phone: "021-123456",
      province: "DKI Jakarta",
      type: "high-school",
    }
  );
  await t.mutation((ctx) =>
    ctx.db.insert("schoolMembers", {
      joinedAt: now,
      role: "student",
      schoolId,
      status: "active",
      updatedAt: now,
      userId: users.student.userId,
    })
  );
  const classId = await admin.mutation(api.classes.mutations.createClass, {
    schoolId,
    name: "Algebra",
    subject: "Mathematics",
    year: "2026",
    visibility: "private",
  });
  return { t, admin, student, outsider, users, schoolId, classId };
}
