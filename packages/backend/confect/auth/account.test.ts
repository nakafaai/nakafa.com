import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

/** The Google method as Convex Auth hands it to the user callbacks. */
function google(profile: {
  readonly email?: string;
  readonly emailVerified: boolean;
  readonly name?: string;
  readonly picture?: string;
}) {
  return {
    name: "google" as const,
    profile: { id: "google-sub-1", ...profile },
  };
}

describe("auth/account", () => {
  it("refuses a Google identity without a verified address", async () => {
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation(internal.auth.account.createGoogle, {
        method: google({ emailVerified: true }),
      })
    ).rejects.toMatchObject({
      data: { _tag: "GoogleAddressRefused", code: "GOOGLE_ADDRESS_MISSING" },
    });
    await expect(
      t.mutation(internal.auth.account.createGoogle, {
        method: google({ email: "ana@example.com", emailVerified: false }),
      })
    ).rejects.toMatchObject({
      data: {
        _tag: "GoogleAddressRefused",
        code: "GOOGLE_ADDRESS_UNVERIFIED",
      },
    });
    await expect(
      t.query((ctx) => ctx.db.query("users").collect())
    ).resolves.toEqual([]);
  });

  it("links the live account that holds the verified address, whatever its case", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        email: "ana@example.com",
        now: NOW,
        suffix: "ana",
      })
    );
    await expect(
      t.mutation(internal.auth.account.createGoogle, {
        method: google({ email: "Ana@Example.com", emailVerified: true }),
      })
    ).resolves.toBe(learner.userId);
    await expect(
      t.query((ctx) => ctx.db.query("users").collect())
    ).resolves.toHaveLength(1);
  });

  it("makes a new account, with its welcome email asked for, for an address no live account holds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithAuth();
    // A deleted account never holds a live address, even one it once had.
    await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        email: "budi@example.com",
        now: NOW,
        suffix: "deleted",
      }).then(({ userId }) =>
        ctx.db.patch("users", userId, { deletedAt: NOW - 1 })
      )
    );
    const named = await t.mutation(internal.auth.account.createGoogle, {
      method: google({
        email: "budi@example.com",
        emailVerified: true,
        name: "Budi Santoso",
        picture: "https://example.com/budi.png",
      }),
    });
    const unnamed = await t.mutation(internal.auth.account.createGoogle, {
      method: google({ email: "citra@example.com", emailVerified: true }),
    });
    const rows = await t.query(async (ctx) => ({
      named: await ctx.db.get("users", named),
      unnamed: await ctx.db.get("users", unnamed),
      welcome: await ctx.db.query("welcomeEmailIntents").collect(),
    }));
    expect(rows.named).toMatchObject({
      credits: DEFAULT_USER_CREDITS,
      email: "budi@example.com",
      image: "https://example.com/budi.png",
      name: "Budi Santoso",
      plan: DEFAULT_USER_PLAN,
      username: expect.any(String),
    });
    expect(rows.named?.mascot).toEqual(expect.any(String));
    // Without a name the address names the account, and without a photo it keeps its animal.
    expect(rows.unnamed).toMatchObject({ name: "citra@example.com" });
    expect(rows.unnamed).not.toHaveProperty("image");
    expect(rows.welcome).toEqual([
      expect.objectContaining({ phase: "awaiting-onboarding", userId: named }),
      expect.objectContaining({
        phase: "awaiting-onboarding",
        userId: unnamed,
      }),
    ]);
  });

  it("admits the sign-in of a live account and refuses a deleted or missing one", async () => {
    const t = createConvexTestWithAuth();
    const live = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "live" })
    );
    const method = google({ email: "live@example.com", emailVerified: true });
    await expect(
      t.mutation(internal.auth.account.signInGoogle, {
        method,
        userId: live.userId,
      })
    ).resolves.toBeNull();
    const deleted = await t.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "deleted",
      });
      await ctx.db.patch("users", userId, { deletedAt: NOW });
      return userId;
    });
    const missing = await t.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing",
      });
      await ctx.db.delete("users", userId);
      return userId;
    });
    for (const userId of [deleted, missing]) {
      await expect(
        t.mutation(internal.auth.account.signInGoogle, { method, userId })
      ).rejects.toMatchObject({
        data: { _tag: "AccountDeleted", code: "ACCOUNT_DELETED" },
      });
    }
  });

  it("refuses every password sign-up, since a school makes each school account", async () => {
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation(internal.auth.account.createSchool, {
        method: { name: "usernamePassword", profile: {} },
      })
    ).rejects.toMatchObject({
      data: { _tag: "SchoolSignUpRefused", code: "SCHOOL_SIGN_UP_REFUSED" },
    });
  });
});
