import { describe, expect, it } from "@effect/vitest";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, Option } from "effect";

/** Inserts one account made before usernames existed, or with the given state. */
function insertAccount(
  ctx: MutationCtx,
  name: string,
  state: { deletedAt?: number; username?: string } = {}
) {
  return ctx.db.insert("users", {
    authId: `auth-${name}-${state.username ?? "none"}`,
    credits: 100,
    creditsResetAt: 0,
    email: `${name}-${state.username ?? "none"}@example.com`,
    name,
    plan: "free",
    ...state,
  });
}

const migrate = (t: TestConvex<typeof schema>, cursor: string | null) =>
  t.mutation(internal.users.migration.allocateUsernames, { cursor });

describe("users/migration", () => {
  it("gives every live account without a username one, oldest first, and leaves the rest", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => ({
      admin: await insertAccount(ctx, "Admin"),
      deleted: await insertAccount(ctx, "Deleted user", { deletedAt: 1 }),
      first: await insertAccount(ctx, "Nabil Fatih"),
      named: await insertAccount(ctx, "Already Named", { username: "keepme" }),
      second: await insertAccount(ctx, "Nabil Fatih"),
    }));

    expect(await migrate(t, null)).toEqual({ allocated: 3, next: null });

    const read = (id: typeof ids.first) =>
      t.query(async (ctx) => (await ctx.db.get("users", id))?.username ?? null);
    expect(await read(ids.admin)).toBe("admin2");
    expect(await read(ids.first)).toBe("nabilfatih");
    expect(await read(ids.second)).toBe("nabilfatih2");
    expect(await read(ids.named)).toBe("keepme");
    expect(await read(ids.deleted)).toBeNull();
  });

  it("allocates nothing on a second pass", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "Nabil Fatih");
      await insertAccount(ctx, "Nabil Fatih");
    });
    expect(await migrate(t, null)).toEqual({ allocated: 2, next: null });
    const before = await t.query((ctx) => ctx.db.query("users").collect());

    expect(await migrate(t, null)).toEqual({ allocated: 0, next: null });

    expect(await t.query((ctx) => ctx.db.query("users").collect())).toEqual(
      before
    );
  });

  it("walks the accounts page by page until no account is left to read", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (const index of Arr.range(1, 105)) {
        await insertAccount(ctx, `Learner ${index}`);
      }
    });

    const first = await migrate(t, null);
    expect(first.allocated).toBe(50);
    expect(first.next).not.toBeNull();
    const second = await migrate(t, first.next);
    expect(second.allocated).toBe(50);
    expect(second.next).not.toBeNull();
    expect(await migrate(t, second.next)).toEqual({ allocated: 5, next: null });

    const withoutUsername = await t.query(async (ctx) =>
      Arr.filter(
        await ctx.db.query("users").collect(),
        (user) => user.username === undefined
      )
    );
    expect(withoutUsername).toEqual([]);
    const usernames = await t.query(async (ctx) =>
      Arr.map(await ctx.db.query("users").collect(), (user) => user.username)
    );
    expect(Arr.dedupe(usernames)).toHaveLength(105);
    expect(
      Option.isSome(Arr.findFirst(usernames, (name) => name === "learner1"))
    ).toBe(true);
  });
});
