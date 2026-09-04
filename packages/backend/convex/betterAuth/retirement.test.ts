import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";

const NOW = Date.UTC(2026, 8, 4, 13, 0, 0);

async function createAccount(
  ctx: MutationCtx,
  input: {
    accountId: string;
    providerId: string;
    userId: string;
  }
) {
  return await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        ...input,
        createdAt: NOW,
        updatedAt: NOW,
      },
      model: "account",
    },
    select: ["_id"],
  });
}

async function createVerification(
  ctx: MutationCtx,
  identifier: string,
  suffix: string
) {
  return await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: NOW,
        expiresAt: NOW + 60_000,
        identifier,
        updatedAt: NOW,
        value: `verification-${suffix}`,
      },
      model: "verification",
    },
    select: ["_id"],
  });
}

async function createUser(
  ctx: MutationCtx,
  index: number,
  fields: {
    displayUsername?: null | string;
    username?: null | string;
  }
) {
  return await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: NOW + index,
        email: `retirement-${index}@example.com`,
        emailVerified: true,
        name: `Retirement ${index}`,
        updatedAt: NOW + index,
        ...fields,
      },
      model: "user",
    },
    select: ["_id"],
  });
}

describe("betterAuth/retirement", () => {
  it("maps invalid cursors to one privacy-safe rollout error", async () => {
    const test = createConvexTestWithBetterAuth();

    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.retirement.audit, {
          cursor: "not-a-convex-cursor",
          target: "usernames",
        })
      )
    ).rejects.toThrow("Unable to process Better Auth retirement evidence.");
  });

  it("retires only credentials with exactly one Google recovery link", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      await createAccount(ctx, {
        accountId: "google-recoverable",
        providerId: "google",
        userId: "recoverable",
      });
      await createAccount(ctx, {
        accountId: "credential-recoverable",
        providerId: "credential",
        userId: "recoverable",
      });
      await createAccount(ctx, {
        accountId: "credential-only",
        providerId: "credential",
        userId: "credential-only",
      });
      await createAccount(ctx, {
        accountId: "google-duplicate-a",
        providerId: "google",
        userId: "duplicate-google",
      });
      await createAccount(ctx, {
        accountId: "google-duplicate-b",
        providerId: "google",
        userId: "duplicate-google",
      });
      await createAccount(ctx, {
        accountId: "credential-duplicate",
        providerId: "credential",
        userId: "duplicate-google",
      });
    });

    const audit = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.retirement.audit, {
        cursor: null,
        target: "credentials",
      })
    );
    expect(audit).toEqual({
      blocked: 2,
      continueCursor: expect.any(String),
      isDone: true,
      matched: 3,
      scanned: 3,
    });

    const firstRetirement = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: null,
        target: "credentials",
      })
    );
    expect(firstRetirement).toEqual({
      ...audit,
      retired: 1,
    });
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.retirement.audit, {
          cursor: null,
          target: "credentials",
        })
      )
    ).resolves.toMatchObject({ blocked: 2, matched: 2 });

    await test.mutation(async (ctx) => {
      await createAccount(ctx, {
        accountId: "google-recovery-added",
        providerId: "google",
        userId: "credential-only",
      });
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "account",
          where: [{ field: "accountId", value: "google-duplicate-b" }],
        },
      });
    });

    const finalRetirement = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: null,
        target: "credentials",
      })
    );
    expect(finalRetirement).toMatchObject({
      blocked: 0,
      matched: 2,
      retired: 2,
    });
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.retirement.audit, {
          cursor: null,
          target: "credentials",
        })
      )
    ).resolves.toMatchObject({ blocked: 0, matched: 0, scanned: 0 });
    await expect(
      test.mutation((ctx) =>
        ctx.runMutation(components.betterAuth.retirement.retire, {
          cursor: null,
          target: "credentials",
        })
      )
    ).resolves.toMatchObject({ blocked: 0, matched: 0, retired: 0 });
  });

  it("retires only reset-password verification rows", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      await createVerification(ctx, "reset-password:alpha", "alpha");
      await createVerification(ctx, "reset-password:omega", "omega");
      await createVerification(ctx, "reset-password;adjacent", "adjacent");
      await createVerification(ctx, "oauth-link", "oauth");
    });

    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.retirement.audit, {
          cursor: null,
          target: "resets",
        })
      )
    ).resolves.toEqual({
      blocked: 0,
      continueCursor: expect.any(String),
      isDone: true,
      matched: 2,
      scanned: 2,
    });
    await expect(
      test.mutation((ctx) =>
        ctx.runMutation(components.betterAuth.retirement.retire, {
          cursor: null,
          target: "resets",
        })
      )
    ).resolves.toMatchObject({ matched: 2, retired: 2 });
    await expect(
      test.mutation((ctx) =>
        ctx.runMutation(components.betterAuth.retirement.retire, {
          cursor: null,
          target: "resets",
        })
      )
    ).resolves.toMatchObject({ matched: 0, retired: 0 });
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "verification",
          select: ["identifier"],
          where: [{ field: "identifier", value: "reset-password;adjacent" }],
        })
      )
    ).resolves.toMatchObject({ identifier: "reset-password;adjacent" });
    await expect(
      test.query((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "verification",
          select: ["identifier"],
          where: [{ field: "identifier", value: "oauth-link" }],
        })
      )
    ).resolves.toMatchObject({ identifier: "oauth-link" });
  });

  it("clears every username field across stable cursor pages", async () => {
    const test = createConvexTestWithBetterAuth();
    const firstUser = await test.mutation(async (ctx) => {
      const first = await createUser(ctx, 0, {
        displayUsername: null,
        username: null,
      });
      for (let index = 1; index < 33; index += 1) {
        await createUser(ctx, index, {
          displayUsername: `Learner ${index}`,
          username: `learner_${index}`,
        });
      }
      await createUser(ctx, 33, {});
      return first;
    });

    const firstPage = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: null,
        target: "usernames",
      })
    );
    expect(firstPage).toMatchObject({
      blocked: 0,
      isDone: false,
      matched: 32,
      retired: 32,
      scanned: 32,
    });
    const secondPage = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: firstPage.continueCursor,
        target: "usernames",
      })
    );
    expect(secondPage).toMatchObject({
      blocked: 0,
      isDone: true,
      matched: 1,
      retired: 1,
      scanned: 2,
    });

    const cleared = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        select: ["username", "displayUsername"],
        where: [{ field: "_id", value: firstUser._id }],
      })
    );
    expect(cleared).not.toHaveProperty("username");
    expect(cleared).not.toHaveProperty("displayUsername");

    const zeroFirstPage = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.retirement.audit, {
        cursor: null,
        target: "usernames",
      })
    );
    const zeroSecondPage = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.retirement.audit, {
        cursor: zeroFirstPage.continueCursor,
        target: "usernames",
      })
    );
    expect(zeroFirstPage).toMatchObject({
      isDone: false,
      matched: 0,
      scanned: 32,
    });
    expect(zeroSecondPage).toMatchObject({
      isDone: true,
      matched: 0,
      scanned: 2,
    });

    const repeatFirstPage = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: null,
        target: "usernames",
      })
    );
    const repeatSecondPage = await test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.retirement.retire, {
        cursor: repeatFirstPage.continueCursor,
        target: "usernames",
      })
    );
    expect(repeatFirstPage.retired + repeatSecondPage.retired).toBe(0);
  });
});
