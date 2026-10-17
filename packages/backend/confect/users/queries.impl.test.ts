import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api, internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const getProfileByUsername = Ref.getFunctionReference(
  refs.public.users.queries.getProfileByUsername
);

describe("users/queries", () => {
  it("loads users by id and auth id", async () => {
    const t = convexTest(schema, convexModules);

    const { deletedUserId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth_user_real_example",
        email: "nabil@example.com",
        mascot: MASCOT_CODE,
        name: "Test Learner",
        plan: "free",
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      const deletedUserId = await ctx.db.insert("users", {
        authId: "deleted_auth_user",
        email: "deleted@example.com",
        mascot: MASCOT_CODE,
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

  it("refuses a visitor and checks a username for an account and for the account that holds it", async () => {
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

    // A visitor learns nothing, not even whether a name is taken.
    await expect(check(t, "nabilfatih")).rejects.toMatchObject({
      data: { _tag: "SessionRequired", code: "UNAUTHENTICATED" },
    });
    const other = signedIn(stranger);
    expect(await check(other, "Teman_Baru")).toBe("available");
    expect(await check(other, "NabilFatih")).toBe("taken");
    expect(await check(signedIn(holder), "nabilfatih")).toBe("available");
    expect(await check(other, "ab")).toBe("tooShort");
    expect(await check(other, "9lives")).toBe("letterFirst");
    expect(await check(other, "a b")).toBe("characters");
    expect(await check(other, "admin")).toBe("notAllowed");
  });

  it("shows the public profile of a username to anyone, and nothing for a name nobody holds", async () => {
    const t = createConvexTestWithBetterAuth();
    const holder = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "profile-holder",
      });
      await ctx.db.patch("users", seeded.userId, {
        bio: "Belajar aljabar setiap hari.",
        image: "https://photos.example.com/holder.jpg",
        name: "Nabil Fatih",
        picture: "photo",
        username: "nabilfatih",
      });
      return seeded;
    });
    const stranger = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "profile-stranger" })
    );
    const profileOf = (caller: Pick<typeof t, "query">, username: string) =>
      caller.query(getProfileByUsername, { username });

    // Only the public fields leave the server: no email, auth id, plan, or settings.
    const expected = {
      _id: holder.userId,
      bio: "Belajar aljabar setiap hari.",
      image: "https://photos.example.com/holder.jpg",
      mascot: MASCOT_CODE,
      name: "Nabil Fatih",
      username: "nabilfatih",
    };
    expect(await profileOf(t, "nabilfatih")).toStrictEqual(expected);
    expect(
      await profileOf(
        t.withIdentity({
          sessionId: stranger.sessionId,
          subject: stranger.authUserId,
        }),
        "nabilfatih"
      )
    ).toStrictEqual(expected);
    expect(await profileOf(t, "nobodyholdsthis")).toBeNull();
  });

  it("hides the photo of an account that shows its animal, and an empty bio", async () => {
    const t = createConvexTestWithBetterAuth();
    const holder = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "animal-holder",
      });
      await ctx.db.patch("users", seeded.userId, {
        image: "https://photos.example.com/hidden.jpg",
        name: "Siti Aminah",
        picture: "animal",
        username: "sitiaminah",
      });
      return seeded;
    });

    expect(
      await t.query(getProfileByUsername, {
        username: "sitiaminah",
      })
    ).toStrictEqual({
      _id: holder.userId,
      mascot: MASCOT_CODE,
      name: "Siti Aminah",
      username: "sitiaminah",
    });
  });
});
