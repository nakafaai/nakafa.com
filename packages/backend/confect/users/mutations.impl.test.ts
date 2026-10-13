import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { getStoredCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
describe("users/mutations", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  it("updates the authenticated user's role", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          role: "student",
        })
    );
    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.updateUserRole, {
        role: "teacher",
      });
    const appUser = await t.query(
      async (ctx) => await ctx.db.get("users", identity.userId)
    );
    expect(appUser?.role).toBe("teacher");
  });
  it("updates the authenticated user's name in auth and app tables", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
        })
    );
    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.updateUserName, {
        name: "Nabil Akbarazzima Fatih",
      });
    const result = await t.query(async (ctx) => {
      const authUser = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "user",
          where: [
            {
              field: "_id",
              value: identity.authUserId,
            },
          ],
        }
      );
      return {
        authUserName:
          authUser && typeof authUser.name === "string" ? authUser.name : null,
        appUser: await ctx.db.get("users", identity.userId),
      };
    });
    expect(result.authUserName).toBe("Nabil Akbarazzima Fatih");
    expect(result.appUser?.name).toBe("Nabil Akbarazzima Fatih");
  });
  it.each(["student", undefined] as const)(
    "reconciles stale chat credits for role %s when the reset period is missing",
    async (role) => {
      const t = createConvexTestWithBetterAuth();
      const identity = await t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, {
          now: NOW,
          credits: -3,
          creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
          role: "student",
        });
        await ctx.db.patch(user.userId, {
          role,
        });
        return user;
      });
      const result = await t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .mutation(api.users.mutations.syncUserInfoForChat, {});
      const reconciledUser = await t.query(async (ctx) => ({
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", identity.userId),
      }));
      const storedResetAt = await t.query(
        async (ctx) =>
          await Effect.runPromise(
            getStoredCreditResetTimestamp("free").pipe(
              Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
            )
          )
      );
      expect(result).toEqual({
        role: role ?? null,
        credits: DEFAULT_USER_CREDITS - 3,
        userId: identity.userId,
      });
      expect(reconciledUser.user?.credits).toBe(DEFAULT_USER_CREDITS - 3);
      expect(reconciledUser.user?.creditsResetAt).toBe(
        Date.UTC(2026, 3, 2, 0, 0, 0)
      );
      expect(reconciledUser.creditTransactions).toEqual([
        expect.objectContaining({
          userId: identity.userId,
          amount: DEFAULT_USER_CREDITS,
          type: "daily-grant",
          balanceAfter: DEFAULT_USER_CREDITS - 3,
        }),
      ]);
      expect(storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
    }
  );
  it("returns current chat credit state without patching when the user is already synced", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      await ctx.db.insert("creditResetPeriods", {
        plan: DEFAULT_USER_PLAN,
        resetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        credits: DEFAULT_USER_CREDITS,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });
    });
    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.syncUserInfoForChat, {});
    const appUser = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(result).toEqual({
      role: null,
      credits: DEFAULT_USER_CREDITS,
      userId: identity.userId,
    });
    expect(appUser.user?.credits).toBe(DEFAULT_USER_CREDITS);
    expect(appUser.user?.creditsResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
    expect(appUser.creditTransactions).toHaveLength(0);
  });

  describe("username", () => {
    /** Seeds an account, optionally with a username, and the caller that signs in as it. */
    async function seedAccount(
      t: ReturnType<typeof createConvexTestWithBetterAuth>,
      suffix: string,
      username?: string
    ) {
      const identity = await t.mutation(
        async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW, suffix })
      );
      if (username !== undefined) {
        await t.mutation((ctx) =>
          ctx.db.patch("users", identity.userId, { username })
        );
      }
      return {
        as: t.withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        }),
        userId: identity.userId,
      };
    }

    it("stores the new username in lowercase and frees the old one", async () => {
      const t = createConvexTestWithBetterAuth();
      const first = await seedAccount(t, "first", "alpha");
      const second = await seedAccount(t, "second", "bravo");

      await first.as.mutation(api.users.mutations.updateUsername, {
        username: "  Alpha_2 ",
      });
      await second.as.mutation(api.users.mutations.updateUsername, {
        username: "alpha",
      });

      const stored = await t.query(async (ctx) => ({
        first: await ctx.db.get("users", first.userId),
        second: await ctx.db.get("users", second.userId),
      }));
      expect(stored.first?.username).toBe("alpha_2");
      expect(stored.second?.username).toBe("alpha");
    });

    it("keeps the username when the caller asks for it again", async () => {
      const t = createConvexTestWithBetterAuth();
      const account = await seedAccount(t, "again", "alpha");

      await expect(
        account.as.mutation(api.users.mutations.updateUsername, {
          username: "Alpha",
        })
      ).resolves.toBeNull();

      const stored = await t.query((ctx) =>
        ctx.db.get("users", account.userId)
      );
      expect(stored?.username).toBe("alpha");
    });

    it.each([
      ["bravo", "taken"],
      ["Bravo", "taken"],
      ["ab", "tooShort"],
      ["9lives", "letterFirst"],
      ["no spaces", "characters"],
      ["alpha.md", "characters"],
      ["admin", "notAllowed"],
      ["pricing", "notAllowed"],
      ["a".repeat(21), "notAllowed"],
    ])(
      "refuses %j because %s and keeps the username",
      async (username, reason) => {
        const t = createConvexTestWithBetterAuth();
        const account = await seedAccount(t, "asking", "alpha");
        await seedAccount(t, "holder", "bravo");

        await expect(
          account.as.mutation(api.users.mutations.updateUsername, { username })
        ).rejects.toMatchObject({
          data: { _tag: "UsernameRejected", reason },
        });

        const stored = await t.query((ctx) =>
          ctx.db.get("users", account.userId)
        );
        expect(stored?.username).toBe("alpha");
      }
    );

    it("answers a visitor without a session as unauthenticated", async () => {
      const t = createConvexTestWithBetterAuth();

      await expect(
        t.mutation(api.users.mutations.updateUsername, { username: "alpha" })
      ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    });
  });

  describe("bio", () => {
    it("stores one trimmed line and clears the bio when the text holds nothing", async () => {
      const t = createConvexTestWithBetterAuth();
      const identity = await t.mutation(
        async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW })
      );
      const as = t.withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      });
      const read = () => t.query((ctx) => ctx.db.get("users", identity.userId));

      await as.mutation(api.users.mutations.updateBio, {
        bio: "  Belajar fisika\nsambil minum teh.  ",
      });
      expect((await read())?.bio).toBe("Belajar fisika sambil minum teh.");

      await as.mutation(api.users.mutations.updateBio, { bio: " \n " });
      expect(await read()).not.toHaveProperty("bio");
    });

    it("refuses a bio of more than 160 characters and keeps the bio", async () => {
      const t = createConvexTestWithBetterAuth();
      const identity = await t.mutation(
        async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW })
      );
      const as = t.withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      });
      await as.mutation(api.users.mutations.updateBio, { bio: "Kept." });

      await expect(
        as.mutation(api.users.mutations.updateBio, { bio: "a".repeat(161) })
      ).rejects.toMatchObject({ data: { _tag: "BioTooLong" } });

      const stored = await t.query((ctx) =>
        ctx.db.get("users", identity.userId)
      );
      expect(stored?.bio).toBe("Kept.");
    });
  });
});
