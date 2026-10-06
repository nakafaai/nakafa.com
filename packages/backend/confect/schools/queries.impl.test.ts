import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Array as Arr, Order } from "effect";

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
  it("distinguishes a missing school from a missing membership", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const viewer = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, { now: NOW });
      await insertSchool({
        ctx,
        createdBy: identity.userId,
        name: "Private School",
        slug: "private-school",
      });
      return identity;
    });
    const authenticated = t.withIdentity({
      subject: viewer.authUserId,
      sessionId: viewer.sessionId,
    });
    await expect(
      authenticated.query(api.schools.queries.getSchoolBySlug, {
        slug: "missing",
      })
    ).rejects.toMatchObject({ data: { code: "SCHOOL_NOT_FOUND" } });
    await expect(
      authenticated.query(api.schools.queries.getSchoolBySlug, {
        slug: "private-school",
      })
    ).rejects.toMatchObject({ data: { code: "MEMBERSHIP_NOT_FOUND" } });
  });
  it("returns the current school and membership for the viewer", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
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
      .query(api.schools.queries.getSchoolBySlug, {
        slug: "nakafa",
      });
    expect(result.school.slug).toBe("nakafa");
    expect(result.membership.role).toBe("admin");
  });
});
describe("schools/queries:getMySchoolLandingState", () => {
  it("returns none when the viewer has no schools", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "none",
        })
    );
    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.schools.queries.getMySchoolLandingState, {});
    expect(result).toEqual({
      kind: "none",
    });
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
    expect(result).toEqual({
      kind: "single",
      slug: "nakafa",
    });
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
    expect(result).toEqual({
      kind: "multiple",
    });
  });
});
describe("schools/queries:getMySchoolsPage", () => {
  it.each(["landing", "page"] as const)(
    "reports a missing membership target in the %s view",
    async (view) => {
      vi.setSystemTime(new Date(NOW));
      const t = createConvexTestWithBetterAuth();
      const viewer = await t.mutation(async (ctx) => {
        const identity = await seedAuthenticatedUser(ctx, { now: NOW });
        const schoolId = await insertSchool({
          ctx,
          createdBy: identity.userId,
          name: "Removed School",
          slug: "removed-school",
        });
        await insertMembership({
          ctx,
          role: "admin",
          schoolId,
          userId: identity.userId,
        });
        await ctx.db.delete("schools", schoolId);
        return identity;
      });
      const authenticated = t.withIdentity({
        subject: viewer.authUserId,
        sessionId: viewer.sessionId,
      });
      const request =
        view === "landing"
          ? authenticated.query(api.schools.queries.getMySchoolLandingState, {})
          : authenticated.query(api.schools.queries.getMySchoolsPage, {
              paginationOpts: { cursor: null, numItems: 10 },
            });
      await expect(request).rejects.toMatchObject({
        data: { code: "SCHOOL_NOT_FOUND" },
      });
    }
  );
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
    expect(
      Arr.sort(
        Arr.map(result.page, (school) => school.slug),
        Order.String
      )
    ).toEqual(["nakafa", "nakafa-2"]);
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
