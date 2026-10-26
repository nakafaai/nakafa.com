import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  CREDITS_NOW,
  creditFixture,
  refundHold,
} from "@repo/backend/test/credits";
import { Array as Arr } from "effect";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CREDITS_NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Makes the fixture's learner a member of a school whose School grant covers `ninaSeats` students' Nina pool. */
async function joinSchool(
  t: Awaited<ReturnType<typeof creditFixture>>["t"],
  userId: Id<"users">,
  ninaSeats: number,
  ninaDailyCredits?: number
) {
  return await t.mutation(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      country: "ID",
      currency: "IDR",
      kind: "school",
      name: "SMP Pool",
      policies: {
        emailDomains: [],
        nina: true,
        ...(ninaDailyCredits === undefined ? {} : { ninaDailyCredits }),
        studentThreads: false,
      },
      slug: "smp-pool",
      status: "active",
    });
    await ctx.db.insert("tenantPeople", {
      account: { claimedAt: 0, method: "card", state: "claimed", userId },
      kind: "member",
      name: "Siswa Pool",
      status: "active",
      tenantId,
    });
    await ctx.db.insert("billingGrants", {
      product: "school",
      tenantId,
      scope: { kind: "tenant" },
      seats: Math.max(ninaSeats, 1),
      ninaSeats,
      source: { kind: "contract", contractId: "contract-pool" },
      validFrom: 0,
      validTo: Date.UTC(2099, 0, 1),
    });
    return tenantId;
  });
}

describe("Nina school pool", () => {
  it("holds a school member's answer from the school's pool, leaves the member's own balance, and gives the pool back the unused part", async () => {
    const { t, identity, reserve } = await creditFixture(5);
    const tenantId = await joinSchool(t, identity.userId, 3);
    const hold = await reserve();
    expect(hold).toMatchObject({
      credits: 50,
      pool: { day: "2026-09-01", month: "2026-09", tenantId },
    });
    await refundHold(t, hold, "settled-turn", 44);
    const result = await t.query(async (ctx) => ({
      days: await ctx.db.query("creditPoolDays").collect(),
      ledger: await ctx.db.query("creditTransactions").collect(),
      pools: await ctx.db.query("creditPools").collect(),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(result.user?.credits).toBe(5);
    expect(result.pools).toMatchObject([{ month: "2026-09", used: 6 }]);
    expect(result.days).toMatchObject([{ day: "2026-09-01", used: 6 }]);
    expect(
      Arr.map(result.ledger, ({ amount, balanceAfter, type }) => [
        type,
        amount,
        balanceAfter,
      ])
    ).toEqual([
      ["usage", -50, 5],
      ["refund", 44, 5],
    ]);
  });

  it("holds no more than the school's daily cap leaves, and refuses a member whose day or school month is spent", async () => {
    const { t, identity, reserve } = await creditFixture(5);
    await joinSchool(t, identity.userId, 1, 30);
    expect((await reserve()).credits).toBe(30);
    await expect(reserve()).rejects.toThrow("Not enough credits");
    vi.setSystemTime(CREDITS_NOW + 86_400_000);
    expect((await reserve()).credits).toBe(30);
    vi.setSystemTime(CREDITS_NOW + 2 * 86_400_000);
    expect((await reserve()).credits).toBe(30);
    // The school's month holds 100 credits for its one student, and 90 are drawn.
    vi.setSystemTime(CREDITS_NOW + 3 * 86_400_000);
    expect((await reserve()).credits).toBe(10);
    vi.setSystemTime(CREDITS_NOW + 4 * 86_400_000);
    await expect(reserve()).rejects.toThrow("Not enough credits");
  });

  it("keeps a member on their own allowance while they hold Pro of their own, or their school's grant has no pool", async () => {
    const own = await creditFixture(5);
    await joinSchool(own.t, own.identity.userId, 3);
    await own.t.mutation((ctx) =>
      ctx.db.insert("billingGrants", {
        product: "pro",
        userId: own.identity.userId,
        source: { kind: "contract", contractId: "contract-own" },
        validFrom: 0,
        validTo: Date.UTC(2099, 0, 1),
      })
    );
    expect((await own.reserve()).pool).toBeUndefined();
    const contract = await creditFixture(5);
    await joinSchool(contract.t, contract.identity.userId, 0);
    const hold = await contract.reserve();
    expect(hold).toMatchObject({ credits: 5 });
    expect(hold.pool).toBeUndefined();
  });

  it("gives a deleted member's pool nothing back", async () => {
    const { t, identity, reserve } = await creditFixture(5);
    await joinSchool(t, identity.userId, 3);
    const hold = await reserve();
    await t.mutation((ctx) => ctx.db.delete("users", identity.userId));
    await refundHold(t, hold, "settled-turn", 44);
    const pools = await t.query((ctx) => ctx.db.query("creditPools").collect());
    expect(pools).toMatchObject([{ used: 50 }]);
  });
});
