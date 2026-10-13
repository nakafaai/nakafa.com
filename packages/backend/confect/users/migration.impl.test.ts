import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, Option } from "effect";

const allocateUsernames = Ref.getFunctionReference(
  refs.internal.users.migration.allocateUsernames
);

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

const migrate = (
  t: TestConvex<typeof schema>,
  cursor: string | null,
  dry: boolean
) => t.mutation(allocateUsernames, { cursor, dry });

/** The username of every account, `null` for an account without one, in the order the accounts were made. */
const usernamesOf = (t: TestConvex<typeof schema>) =>
  t.query(async (ctx) =>
    Arr.map(
      await ctx.db.query("users").collect(),
      (user) => user.username ?? null
    )
  );

describe("users/migration", () => {
  it("gives every live account without a username one, oldest first, and leaves the rest", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "Admin");
      await insertAccount(ctx, "Deleted user", { deletedAt: 1 });
      await insertAccount(ctx, "Nabil Fatih");
      await insertAccount(ctx, "Already Named", { username: "keepme" });
      await insertAccount(ctx, "Nabil Fatih");
    });

    expect(await migrate(t, null, false)).toEqual({
      allocated: 3,
      next: null,
      waiting: 3,
    });

    expect(await usernamesOf(t)).toEqual([
      "admin2",
      null,
      "nabilfatih",
      "keepme",
      "nabilfatih2",
    ]);
  });

  it("counts the accounts that wait in a dry pass and writes nothing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "Nabil Fatih");
      await insertAccount(ctx, "Deleted user", { deletedAt: 1 });
      await insertAccount(ctx, "Already Named", { username: "keepme" });
      await insertAccount(ctx, "Siti");
    });
    const before = await t.query((ctx) => ctx.db.query("users").collect());

    expect(await migrate(t, null, true)).toEqual({
      allocated: 0,
      next: null,
      waiting: 2,
    });

    expect(await t.query((ctx) => ctx.db.query("users").collect())).toEqual(
      before
    );
  });

  it("allocates nothing on a second pass, and a dry pass then finds none waiting", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "Nabil Fatih");
      await insertAccount(ctx, "Nabil Fatih");
    });
    expect(await migrate(t, null, false)).toEqual({
      allocated: 2,
      next: null,
      waiting: 2,
    });
    const before = await t.query((ctx) => ctx.db.query("users").collect());

    expect(await migrate(t, null, false)).toEqual({
      allocated: 0,
      next: null,
      waiting: 0,
    });
    expect(await migrate(t, null, true)).toEqual({
      allocated: 0,
      next: null,
      waiting: 0,
    });

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

    const first = await migrate(t, null, false);
    expect(first).toMatchObject({ allocated: 50, waiting: 50 });
    expect(first.next).not.toBeNull();
    const second = await migrate(t, first.next, false);
    expect(second).toMatchObject({ allocated: 50, waiting: 50 });
    expect(second.next).not.toBeNull();
    expect(await migrate(t, second.next, false)).toEqual({
      allocated: 5,
      next: null,
      waiting: 5,
    });

    const usernames = await usernamesOf(t);
    expect(usernames).not.toContain(null);
    expect(Arr.dedupe(usernames)).toHaveLength(105);
    expect(
      Option.isSome(Arr.findFirst(usernames, (name) => name === "learner1"))
    ).toBe(true);
  });
});
