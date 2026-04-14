import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 15, 9, 0, 0);

/** Insert one school row with the minimum schema fields required by the test. */
async function insertSchool({
  ctx,
  createdBy,
  name,
  slug,
}: {
  ctx: MutationCtx;
  createdBy: Id<"users">;
  name: string;
  slug: string;
}) {
  return await ctx.db.insert("schools", {
    name,
    slug,
    email: `${slug}@example.com`,
    city: "Jakarta",
    province: "DKI Jakarta",
    type: "high-school",
    currentStudents: 0,
    currentTeachers: 0,
    updatedAt: NOW,
    createdBy,
    updatedBy: createdBy,
  });
}

/** Insert one active school membership row for the given user and school. */
async function insertMembership({
  ctx,
  role,
  schoolId,
  userId,
}: {
  ctx: MutationCtx;
  role: "admin" | "student" | "teacher";
  schoolId: Id<"schools">;
  userId: Id<"users">;
}) {
  await ctx.db.insert("schoolMembers", {
    schoolId,
    userId,
    role,
    status: "active",
    joinedAt: NOW,
    updatedAt: NOW,
  });
}

describe("schools/queries:getSchoolBySlug", () => {
  it("returns the current school and membership for the viewer", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, { now: NOW });
      const firstSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa",
        slug: "nakafa",
      });
      const secondSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa 2",
        slug: "nakafa-2",
      });

      await insertMembership({
        ctx,
        role: "admin",
        schoolId: firstSchoolId,
        userId: viewer.userId,
      });
      await insertMembership({
        ctx,
        role: "teacher",
        schoolId: secondSchoolId,
        userId: viewer.userId,
      });

      return viewer;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getSchoolBySlug, { slug: "nakafa" });

    expect(result.school.slug).toBe("nakafa");
    expect(result.membership.role).toBe("admin");
  });
});

describe("schools/queries:getMySchoolLandingState", () => {
  it("returns none when the viewer has no schools", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, { now: NOW, suffix: "none" });
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getMySchoolLandingState, {});

    expect(result).toEqual({ kind: "none" });
  });

  it("returns single when the viewer belongs to one school", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "single",
      });
      const schoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa",
        slug: "nakafa",
      });

      await insertMembership({
        ctx,
        role: "admin",
        schoolId,
        userId: viewer.userId,
      });

      return viewer;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getMySchoolLandingState, {});

    expect(result).toEqual({ kind: "single", slug: "nakafa" });
  });

  it("returns multiple when the viewer belongs to many schools", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "multiple",
      });
      const firstSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa",
        slug: "nakafa",
      });
      const secondSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa 2",
        slug: "nakafa-2",
      });

      await insertMembership({
        ctx,
        role: "admin",
        schoolId: firstSchoolId,
        userId: viewer.userId,
      });
      await insertMembership({
        ctx,
        role: "teacher",
        schoolId: secondSchoolId,
        userId: viewer.userId,
      });

      return viewer;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getMySchoolLandingState, {});

    expect(result).toEqual({ kind: "multiple" });
  });
});

describe("schools/queries:getMySchoolsPage", () => {
  it("returns paginated school summaries", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "page",
      });
      const firstSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa",
        slug: "nakafa",
      });
      const secondSchoolId = await insertSchool({
        ctx,
        createdBy: viewer.userId,
        name: "Nakafa 2",
        slug: "nakafa-2",
      });

      await insertMembership({
        ctx,
        role: "admin",
        schoolId: firstSchoolId,
        userId: viewer.userId,
      });
      await insertMembership({
        ctx,
        role: "teacher",
        schoolId: secondSchoolId,
        userId: viewer.userId,
      });

      return viewer;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getMySchoolsPage, {
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
      });

    expect(result.page.map((school) => school.slug).sort()).toEqual([
      "nakafa",
      "nakafa-2",
    ]);
    expect(result.page[0]).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        type: expect.any(String),
      })
    );
  });
});
