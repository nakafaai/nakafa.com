import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { convexModules } from "@repo/backend/confect/test.setup";
import { accountMascot } from "@repo/backend/confect/users/mascot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { encode } from "@repo/mascot/code";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr } from "effect";

const assignMascots = Ref.getFunctionReference(
  refs.internal.users.backfill.assignMascots
);

/** An animal that is already stored, which the backfill must leave as it is. */
const KEPT = "cat.0.243e66.right.open";

/** Inserts one account made before the animal existed, or with the given state. */
function insertAccount(
  ctx: MutationCtx,
  name: string,
  state: { deletedAt?: number; mascot?: string } = {}
) {
  return ctx.db.insert("users", {
    authId: `auth-${name}`,
    credits: 100,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
    ...state,
  });
}

const assign = (
  t: TestConvex<typeof schema>,
  cursor: string | null,
  dry: boolean
) => t.mutation(assignMascots, { cursor, dry });

/** What one call of the backfill reports. */
type Page = Awaited<ReturnType<typeof assign>>;

/** The stored animal of every account, `null` for an account without one, in the order the accounts were made. */
const mascotsOf = (t: TestConvex<typeof schema>) =>
  t.query(async (ctx) =>
    Arr.map(
      await ctx.db.query("users").collect(),
      (user) => user.mascot ?? null
    )
  );

describe("users/backfill", () => {
  it("gives every account without an animal the animal of its auth id, deleted accounts included, and leaves the rest", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "ada");
      await insertAccount(ctx, "deleted", { deletedAt: 1 });
      await insertAccount(ctx, "siti", { mascot: KEPT });
      await insertAccount(ctx, "budi");
    });

    expect(await assign(t, null, false)).toEqual({
      assigned: 3,
      next: null,
      waiting: 3,
    });

    expect(await mascotsOf(t)).toEqual([
      encode(accountMascot("auth-ada")),
      encode(accountMascot("auth-deleted")),
      KEPT,
      encode(accountMascot("auth-budi")),
    ]);
  });

  it("counts the accounts that wait in a dry pass and writes nothing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "ada");
      await insertAccount(ctx, "deleted", { deletedAt: 1 });
      await insertAccount(ctx, "siti", { mascot: KEPT });
    });
    const before = await t.query((ctx) => ctx.db.query("users").collect());

    expect(await assign(t, null, true)).toEqual({
      assigned: 0,
      next: null,
      waiting: 2,
    });

    expect(await t.query((ctx) => ctx.db.query("users").collect())).toEqual(
      before
    );
  });

  it("assigns nothing on a second pass, and a dry pass then finds none waiting", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertAccount(ctx, "ada");
      await insertAccount(ctx, "budi");
    });
    expect(await assign(t, null, false)).toEqual({
      assigned: 2,
      next: null,
      waiting: 2,
    });
    const before = await t.query((ctx) => ctx.db.query("users").collect());

    expect(await assign(t, null, false)).toEqual({
      assigned: 0,
      next: null,
      waiting: 0,
    });
    expect(await assign(t, null, true)).toEqual({
      assigned: 0,
      next: null,
      waiting: 0,
    });

    expect(await t.query((ctx) => ctx.db.query("users").collect())).toEqual(
      before
    );
  });

  it("walks the accounts page by page until no account is left to read", async () => {
    const t = convexTest(schema, convexModules);
    const learners = Arr.range(1, 105);
    await t.mutation(async (ctx) => {
      for (const index of learners) {
        await insertAccount(ctx, `learner${index}`);
      }
    });

    // Each call continues from the cursor of the last one. The walk gives up
    // after one call per account, so a cursor that never ends fails below.
    let pages: readonly Page[] = [];
    let cursor: string | null = null;
    do {
      const page = await assign(t, cursor, false);
      pages = Arr.append(pages, page);
      cursor = page.next;
    } while (cursor !== null && pages.length <= learners.length);
    expect(cursor).toBeNull();

    // More accounts than one page holds, so the walk takes several calls.
    expect(pages.length).toBeGreaterThan(1);
    expect(Arr.reduce(pages, 0, (total, page) => total + page.assigned)).toBe(
      learners.length
    );
    const mascots = await mascotsOf(t);
    expect(mascots).toHaveLength(learners.length);
    expect(mascots).not.toContain(null);
  });
});
