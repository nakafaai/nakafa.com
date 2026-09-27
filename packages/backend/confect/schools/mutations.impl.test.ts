import { assert, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";

const NOW = Date.UTC(2026, 7, 22, 5, 0, 0);
const schoolInput = {
  address: "Jl. Merdeka 1",
  city: "Jakarta",
  name: "Select",
  phone: "021-123456",
  province: "DKI Jakarta",
  type: "high-school" as const,
};
describe("schools/mutations", () => {
  it("rejects duplicate school email without creating another school or membership", async () => {
    const { t, admin } = await createClassFixture();
    const read = () =>
      t.query(async (ctx) => ({
        schools: await ctx.db.query("schools").collect(),
        members: await ctx.db.query("schoolMembers").collect(),
        codes: await ctx.db.query("schoolInviteCodes").collect(),
      }));
    const before = await read();
    await expect(
      admin.mutation(api.schools.mutations.createSchool, {
        ...schoolInput,
        email: "class-school@example.com",
      })
    ).rejects.toMatchObject({ data: { code: "SCHOOL_ALREADY_EXISTS" } });
    expect(await read()).toEqual(before);
  });

  it.each(["missing-code", "missing-school"] as const)(
    "rejects a broken school invitation: %s",
    async (missing) => {
      const { t, outsider, schoolId } = await createClassFixture();
      const code = await t.mutation(async (ctx) => {
        const invitation = await ctx.db.query("schoolInviteCodes").first();
        assert(invitation);
        if (missing === "missing-school") {
          await ctx.db.delete(schoolId);
        }
        return missing === "missing-code"
          ? "nonexistent-invite"
          : invitation.code;
      });
      const before = await t.query((ctx) =>
        ctx.db.query("schoolMembers").collect()
      );
      await expect(
        outsider.mutation(api.schools.mutations.joinSchool, { code })
      ).rejects.toMatchObject({
        data: {
          code:
            missing === "missing-code" ? "INVALID_CODE" : "SCHOOL_NOT_FOUND",
        },
      });
      expect(
        await t.query((ctx) => ctx.db.query("schoolMembers").collect())
      ).toEqual(before);
    }
  );

  it.each([
    { patch: { enabled: false }, code: "CODE_DISABLED" },
    { patch: { expiresAt: 0 }, code: "CODE_EXPIRED" },
    { patch: { maxUsage: 0 }, code: "CODE_LIMIT_REACHED" },
  ])(
    "rejects an unusable school invitation: $code",
    async ({ patch, code }) => {
      const { t, outsider, schoolId, users } = await createClassFixture();
      const invitation = await t.mutation(async (ctx) => {
        const invite = await ctx.db.query("schoolInviteCodes").first();
        assert(invite);
        await ctx.db.patch("schoolInviteCodes", invite._id, patch);
        return invite;
      });
      await expect(
        outsider.mutation(api.schools.mutations.joinSchool, {
          code: invitation.code,
        })
      ).rejects.toMatchObject({ data: { code } });
      const state = await t.query(async (ctx) => ({
        invite: await ctx.db.get("schoolInviteCodes", invitation._id),
        membership: await ctx.db
          .query("schoolMembers")
          .withIndex("by_schoolId_and_userId_and_status", (query) =>
            query
              .eq("schoolId", schoolId)
              .eq("userId", users.outsider.userId)
              .eq("status", "active")
          )
          .unique(),
      }));
      expect(state.invite?.currentUsage).toBe(0);
      expect(state.membership).toBeNull();
    }
  );
  it("keeps generated school slugs outside static School routes", async () => {
    const t = createConvexTestWithBetterAuth();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reserved-school-slug",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: user.sessionId,
      subject: user.authUserId,
    });
    const first = await authenticated.mutation(
      api.schools.mutations.createSchool,
      {
        ...schoolInput,
        email: "reserved-school-1@example.com",
      }
    );
    const second = await authenticated.mutation(
      api.schools.mutations.createSchool,
      {
        ...schoolInput,
        email: "reserved-school-2@example.com",
      }
    );
    expect(first.slug).toBe("select-1");
    expect(second.slug).toBe("select-2");
  });
});
