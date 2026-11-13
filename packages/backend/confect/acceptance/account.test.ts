import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { seedPasswordAccount } from "@repo/backend/confect/acceptance/account";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { inMutation } from "@repo/backend/test/client";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

beforeEach(() => {
  vi.stubEnv("ACCEPTANCE_SEED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Whether the account signs in with the password, through the password component. */
function signsInWith(
  t: ReturnType<typeof createConvexTestWithAuth>,
  userId: Id<"users">,
  password: string
) {
  return t.mutation((ctx) =>
    ctx.runMutation(components.authPassword.public.verifyPassword, {
      password,
      userId,
    })
  );
}

describe("acceptance/account", () => {
  it("makes a password account for a new address, whose username is its own id", async () => {
    const t = createConvexTestWithAuth();
    const seeded = await t.mutation(internal.acceptance.accounts.create, {
      email: "browser@example.test",
      name: "Browser Learner",
    });
    await expect(
      t.query((ctx) => ctx.db.get("users", seeded.userId))
    ).resolves.toMatchObject({
      email: "browser@example.test",
      name: "Browser Learner",
    });
    await expect(
      t.query((ctx) =>
        ctx.runQuery(components.authUsername.public.getUsername, {
          userId: seeded.userId,
        })
      )
    ).resolves.toBe(seeded.userId);
    await expect(
      signsInWith(t, seeded.userId, seeded.password)
    ).resolves.toEqual({ success: true });
  });

  it("gives the account that holds the address a fresh password instead of a second account", async () => {
    const t = createConvexTestWithAuth();
    const held = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        email: "held@example.test",
        now: NOW,
        suffix: "held",
      })
    );
    const first = await t.mutation(internal.acceptance.accounts.create, {
      email: "held@example.test",
      name: "Ignored",
    });
    const second = await t.mutation(internal.acceptance.accounts.create, {
      email: "held@example.test",
      name: "Ignored",
    });
    expect([first.userId, second.userId]).toEqual([held.userId, held.userId]);
    expect(second.password).not.toBe(first.password);
    await expect(
      signsInWith(t, held.userId, second.password)
    ).resolves.toEqual({ success: true });
    await expect(
      t.query((ctx) => ctx.db.query("users").collect())
    ).resolves.toHaveLength(1);
  });

  it("refuses outside the acceptance runtime", async () => {
    vi.stubEnv("ACCEPTANCE_SEED", "false");
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation(internal.acceptance.accounts.create, {
        email: "refused@example.test",
        name: "Refused",
      })
    ).rejects.toMatchObject({ data: { _tag: "SeedRefused" } });
    await expect(
      t.mutation(internal.acceptance.accounts.profile, {
        name: "Refused",
        userId: (
          await t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: NOW, suffix: "refused" })
          )
        ).userId,
      })
    ).rejects.toMatchObject({ data: { _tag: "SeedRefused" } });
  });

  it("dies when the password component refuses a drawn token, which only a defect can cause", async () => {
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation((ctx) => {
        const original = ctx.runMutation.bind(ctx);
        vi.spyOn(ctx, "runMutation")
          .mockImplementationOnce(original)
          .mockResolvedValueOnce({
            success: false,
            userError: { error: "PASSWORD_TOO_COMMON" },
          });
        return inMutation(() =>
          seedPasswordAccount({ email: "defect@example.test", name: "Defect" })
        )(ctx);
      })
    ).rejects.toThrow("A drawn token is not a password Convex Auth takes.");
  });

  it("writes only the profile fields a test names", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "profile" })
    );
    const before = await t.query((ctx) => ctx.db.get("users", learner.userId));
    await t.mutation(internal.acceptance.accounts.profile, {
      userId: learner.userId,
    });
    await expect(
      t.query((ctx) => ctx.db.get("users", learner.userId))
    ).resolves.toEqual(before);
    await t.mutation(internal.acceptance.accounts.profile, {
      image: "https://example.test/photo.png",
      name: "Renamed Learner",
      userId: learner.userId,
    });
    await expect(
      t.query((ctx) => ctx.db.get("users", learner.userId))
    ).resolves.toMatchObject({
      image: "https://example.test/photo.png",
      name: "Renamed Learner",
    });
  });
});
