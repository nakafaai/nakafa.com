import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api, internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

describe("users/queries", () => {
  it("loads users by id and auth id", async () => {
    const t = convexTest(schema, convexModules);

    const { deletedUserId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth_user_real_example",
        email: "nabil@example.com",
        name: "Test Learner",
        plan: "free",
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      const deletedUserId = await ctx.db.insert("users", {
        authId: "deleted_auth_user",
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      await ctx.db.delete("users", deletedUserId);

      return { deletedUserId, userId };
    });

    const [byId, byAuthId, missingById, missingByAuthId] = await Promise.all([
      t.query(internal.users.queries.getUserById, { userId }),
      t.query(internal.users.queries.getUserByAuthId, {
        authId: "auth_user_real_example",
      }),
      t.query(internal.users.queries.getUserById, {
        userId: deletedUserId,
      }),
      t.query(internal.users.queries.getUserByAuthId, {
        authId: "missing_auth_user",
      }),
    ]);

    expect(byId?._id).toBe(userId);
    expect(byAuthId?._id).toBe(userId);
    expect(missingById).toBeNull();
    expect(missingByAuthId).toBeNull();
  });

  it("checks a username for a visitor and for the account that holds it", async () => {
    const t = createConvexTestWithBetterAuth();
    const holder = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "holder",
      });
      await ctx.db.patch("users", seeded.userId, { username: "nabilfatih" });
      return seeded;
    });
    const stranger = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" })
    );
    const signedIn = (account: typeof holder) =>
      t.withIdentity({
        sessionId: account.sessionId,
        subject: account.authUserId,
      });
    const check = (caller: Pick<typeof t, "query">, username: string) =>
      caller.query(api.users.queries.checkUsername, { username });

    expect(await check(t, "Teman_Baru")).toBe("available");
    expect(await check(t, "NabilFatih")).toBe("taken");
    expect(await check(signedIn(stranger), "nabilfatih")).toBe("taken");
    expect(await check(signedIn(holder), "nabilfatih")).toBe("available");
    expect(await check(t, "ab")).toBe("tooShort");
    expect(await check(t, "9lives")).toBe("letterFirst");
    expect(await check(t, "a b")).toBe("characters");
    expect(await check(t, "admin")).toBe("notAllowed");
  });

  it("reads the public profile of an account by its username in any case", async () => {
    const t = createConvexTestWithBetterAuth();
    const { plain, rich } = await t.mutation(async (ctx) => {
      const rich = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "rich",
      });
      await ctx.db.patch("users", rich.userId, {
        bio: "Belajar fisika.",
        image: "https://example.com/rich.png",
        username: "rich_one",
      });
      const plain = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "plain",
      });
      await ctx.db.patch("users", plain.userId, { username: "plain_one" });
      return { plain, rich };
    });

    expect(
      await t.query(api.users.queries.getProfileByUsername, {
        username: "Rich_One",
      })
    ).toEqual({
      _id: rich.userId,
      bio: "Belajar fisika.",
      image: "https://example.com/rich.png",
      name: "User rich",
      username: "rich_one",
    });
    expect(
      await t.query(api.users.queries.getProfileByUsername, {
        username: "plain_one",
      })
    ).toEqual({
      _id: plain.userId,
      name: "User plain",
      username: "plain_one",
    });
  });

  it("finds no profile for a text that is no username, a free username, or a deleted account", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "gone",
      });
      await ctx.db.patch("users", seeded.userId, {
        deletedAt: NOW,
        username: "gone_one",
      });
    });

    for (const username of ["gone_one", "nobody", "no body", "ab", ""]) {
      expect(
        await t.query(api.users.queries.getProfileByUsername, { username })
      ).toBeNull();
    }
  });

  it("reads the username of an account by the id that older addresses carry", async () => {
    const t = createConvexTestWithBetterAuth();
    const { deleted, legacy, named, otherTableId } = await t.mutation(
      async (ctx) => {
        const named = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "named",
        });
        await ctx.db.patch("users", named.userId, { username: "named_one" });
        const legacy = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "legacy",
        });
        const deleted = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "deleted",
        });
        await ctx.db.patch("users", deleted.userId, {
          deletedAt: NOW,
          username: "deleted_one",
        });
        const otherTableId = await ctx.db.insert("creditResetPeriods", {
          plan: "free",
          resetAt: NOW,
        });
        return { deleted, legacy, named, otherTableId };
      }
    );
    const missing = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("users", {
        authId: "auth-missing",
        credits: 0,
        creditsResetAt: 0,
        email: "missing@example.com",
        name: "Missing",
        plan: "free",
        username: "missing_one",
      });
      await ctx.db.delete("users", id);
      return id;
    });
    const read = (userId: string) =>
      t.query(api.users.queries.getUsernameById, { userId });

    expect(await read(named.userId)).toBe("named_one");
    expect(await read(legacy.userId)).toBeNull();
    expect(await read(deleted.userId)).toBeNull();
    expect(await read(missing)).toBeNull();
    expect(await read(otherTableId)).toBeNull();
    expect(await read("settings")).toBeNull();
    expect(await read("")).toBeNull();
  });
});
