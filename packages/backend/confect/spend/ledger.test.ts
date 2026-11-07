import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  holdSpend,
  monthOf,
  settleSpend,
} from "@repo/backend/confect/spend/ledger";
import type { Claim } from "@repo/backend/confect/spend/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  insertMember,
  insertSchool,
  insertTopUpPack,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Cause, Exit } from "effect";

const NOW = Date.UTC(2026, 10, 7, 10);
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/** One learner on a plan. */
function insertLearner(ctx: MutationCtx, plan: "free" | "pro") {
  return ctx.db.insert("users", {
    authId: `auth-${plan}`,
    credits: 0,
    creditsResetAt: NOW,
    email: `${plan}@example.com`,
    mascot: MASCOT_CODE,
    name: "Ledger",
    plan,
  });
}

/** A School grant that gives the school's pool `ninaSeats` students' credits. */
function insertPoolGrant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  ninaSeats: number
) {
  return ctx.db.insert("billingGrants", {
    product: "school",
    tenantId,
    scope: { kind: "tenant" },
    seats: 10,
    ninaSeats,
    source: { kind: "contract", contractId: "ledger-test" },
    validFrom: NOW - 1000,
    validTo: NOW + ONE_YEAR,
  });
}

/** Every vendor row, as a person reads it. */
async function rowsOf(ctx: MutationCtx) {
  const rows = await ctx.db.query("vendorSpend").collect();
  return rows.map(({ calls, held, month, payer, spent, vendor }) => ({
    calls,
    held,
    month,
    payer,
    spent,
    vendor,
  }));
}

/** The failure a refused hold ends with. */
function refusalOf(exit: Exit.Exit<unknown, unknown>) {
  return Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
}

describe("spend/ledger", () => {
  it("names the calendar month of a moment", () => {
    expect(monthOf(NOW)).toBe("2026-11");
  });

  it("holds a learner's calls within their plan's month and settles each to its cost", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const userId = await insertLearner(ctx, "free");
      const claim: Claim = { kind: "learner", userId };
      // Free: 10 credits a day over 31 days, at $0.0025 a credit with the reserve.
      const first = await runInMutation(ctx, holdSpend(claim, "chat", 500_000));
      const refused = await exitInMutation(
        ctx,
        holdSpend(claim, "search", 300_000)
      );
      expect(refusalOf(refused)).toMatchObject({
        _tag: "SpendRefused",
        budget: 775_000,
        held: 300_000,
        used: 500_000,
        vendor: "firecrawl",
      });
      await runInMutation(ctx, settleSpend(first.escrowId, 100_000));
      // A second settle of the same escrow changes nothing.
      await runInMutation(ctx, settleSpend(first.escrowId, 400_000));
      const second = await runInMutation(
        ctx,
        holdSpend(claim, "search", 300_000)
      );
      expect(second.held).toBe(300_000);
      expect(await rowsOf(ctx)).toEqual([
        {
          calls: 1,
          held: 0,
          month: "2026-11",
          payer: { kind: "learner", userId },
          spent: 100_000,
          vendor: "anthropic",
        },
        {
          calls: 1,
          held: 300_000,
          month: "2026-11",
          payer: { kind: "learner", userId },
          spent: 0,
          vendor: "firecrawl",
        },
      ]);
      const escrow = await ctx.db.get(first.escrowId);
      expect(escrow?.state).toEqual({ spent: 100_000, status: "settled" });
    });
  });

  it("adds a call to its vendor's row and a cost above the hold to what was spent", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const userId = await insertLearner(ctx, "pro");
      const claim: Claim = { kind: "learner", userId };
      const first = await runInMutation(ctx, holdSpend(claim, "chat", 1000));
      const second = await runInMutation(
        ctx,
        holdSpend(claim, "specialist", 2000)
      );
      await runInMutation(ctx, settleSpend(first.escrowId, 1500));
      await runInMutation(ctx, settleSpend(second.escrowId, 2000));
      expect(await rowsOf(ctx)).toEqual([
        {
          calls: 2,
          held: 0,
          month: "2026-11",
          payer: { kind: "learner", userId },
          spent: 3500,
          vendor: "anthropic",
        },
      ]);
    });
  });

  it("counts a learner's running top-up packs, spent or not, in their budget", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const userId = await insertLearner(ctx, "pro");
      await insertTopUpPack(ctx, userId, {
        expiresAt: NOW + ONE_YEAR,
        providerPaymentId: "pack-spent",
        remaining: 0,
      });
      const claim: Claim = { kind: "learner", userId };
      // Pro 1,000 a month and a pack of 1,000: 2,000 credits at $0.0025.
      await runInMutation(ctx, holdSpend(claim, "chat", 5_000_000));
      const refused = await exitInMutation(ctx, holdSpend(claim, "chat", 1));
      expect(refusalOf(refused)).toMatchObject({ budget: 5_000_000 });
    });
  });

  it("holds a member's work against the school while its plan grants AI credits", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const userId = await insertLearner(ctx, "free");
      const tenantId = await insertSchool(ctx);
      await insertMember(ctx, tenantId, userId);
      await insertPoolGrant(ctx, tenantId, 3);
      const claim: Claim = { kind: "member", tenantId, userId };
      // Three students' 100 credits a month: 300 credits at $0.0025.
      await runInMutation(ctx, holdSpend(claim, "import", 700_000));
      const refused = await exitInMutation(
        ctx,
        holdSpend(claim, "import", 50_001)
      );
      expect(refusalOf(refused)).toMatchObject({ budget: 750_000 });
      expect(await rowsOf(ctx)).toEqual([
        {
          calls: 1,
          held: 700_000,
          month: "2026-11",
          payer: { kind: "school", tenantId },
          spent: 0,
          vendor: "anthropic",
        },
      ]);
    });
  });

  it("holds a member's work against their own account when the school's plan grants no AI credits", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const userId = await insertLearner(ctx, "free");
      const tenantId = await insertSchool(ctx);
      await insertPoolGrant(ctx, tenantId, 0);
      await runInMutation(
        ctx,
        holdSpend({ kind: "member", tenantId, userId }, "embedding", 10)
      );
      expect((await rowsOf(ctx))[0]?.payer).toEqual({
        kind: "learner",
        userId,
      });
    });
  });

  it("refuses a school's own work when its plan grants no AI credits", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const refused = await exitInMutation(
        ctx,
        holdSpend({ kind: "school", tenantId }, "import", 1)
      );
      expect(refusalOf(refused)).toMatchObject({
        _tag: "SpendRefused",
        budget: 0,
      });
      expect(await rowsOf(ctx)).toEqual([]);
    });
  });

  it("holds a school's own work against its pool", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await insertPoolGrant(ctx, tenantId, 1);
      await runInMutation(
        ctx,
        holdSpend({ kind: "school", tenantId }, "embedding", 250_000)
      );
      const refused = await exitInMutation(
        ctx,
        holdSpend({ kind: "school", tenantId }, "embedding", 1)
      );
      expect(refusalOf(refused)).toMatchObject({ budget: 250_000 });
    });
  });

  it("holds Nakafa's own work against its monthly budget", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      const claim: Claim = { kind: "nakafa" };
      await runInMutation(ctx, holdSpend(claim, "embedding", 29_000_000));
      const second = await runInMutation(
        ctx,
        holdSpend(claim, "embedding", 1_000_000)
      );
      expect(second.held).toBe(1_000_000);
      const refused = await exitInMutation(
        ctx,
        holdSpend(claim, "decision", 1)
      );
      expect(refusalOf(refused)).toMatchObject({ budget: 30_000_000 });
      expect(await rowsOf(ctx)).toEqual([
        {
          calls: 2,
          held: 30_000_000,
          month: "2026-11",
          payer: { kind: "nakafa" },
          spent: 0,
          vendor: "google",
        },
      ]);
    });
  });
});
