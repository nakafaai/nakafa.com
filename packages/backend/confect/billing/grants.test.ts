import { describe, expect, it } from "@effect/vitest";
import type { BillingAccountId } from "@repo/backend/confect/billing/accounts";
import {
  projectSchoolPage,
  projectUserPlan,
  syncSubscriptionGrant,
} from "@repo/backend/confect/billing/grants";
import {
  applySubscriptionState,
  type BillingSubscriptionState,
} from "@repo/backend/confect/billing/subscriptions";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  insertMember,
  insertSchool,
  insertSchoolGrant,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Effect, Exit } from "effect";

const START = Date.UTC(2026, 9, 1);
const PERIOD_END = Date.UTC(2026, 10, 1);
const DECEMBER_END = Date.UTC(2026, 11, 1);

/** Inserts a person with a free plan and a Polar account for them. */
async function insertPerson(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-billing-grant",
    credits: 0,
    creditsResetAt: START,
    email: "billing-grant@example.com",
    mascot: MASCOT_CODE,
    name: "Billing Grant",
    plan: "free",
  });
  const accountId = await ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: "polar",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
  return { accountId, userId };
}

/** A paid Pro monthly period for one account, written as Polar reports it. */
function proState(
  accountId: BillingAccountId,
  end = PERIOD_END
): BillingSubscriptionState {
  return {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: "active",
    currentPeriodStart: START,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: false,
    provider: {
      kind: "polar",
      subscriptionId: "sub_grant_1",
      productId: "prod_grant_1",
      priceId: null,
    },
    providerUpdatedAt: START,
  };
}

describe("billing/grants", () => {
  it("grants Pro for the paid period and projects the plan onto the user", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const plan = await runInMutation(ctx, projectUserPlan(userId, START + 1));
      const user = await ctx.db.get(userId);
      return { plan, userPlan: user?.plan };
    });
    expect(result).toEqual({ plan: "pro", userPlan: "pro" });
  });

  it("renews the same grant when the subscription writes a new period", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId } = await insertPerson(ctx);
      const first = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      const grantId = await runInMutation(
        ctx,
        syncSubscriptionGrant(first.subscriptionId)
      );
      const renewedEnd = Date.UTC(2026, 11, 1);
      await runInMutation(
        ctx,
        applySubscriptionState({
          ...proState(accountId, renewedEnd),
          providerUpdatedAt: START + 1,
        })
      );
      const renewedId = await runInMutation(
        ctx,
        syncSubscriptionGrant(first.subscriptionId)
      );
      const grants = await ctx.db.query("billingGrants").collect();
      return {
        count: grants.length,
        sameGrant: grantId === renewedId,
        validTo: grants[0]?.validTo,
      };
    });
    expect(result).toEqual({
      count: 1,
      sameGrant: true,
      validTo: Date.UTC(2026, 11, 1),
    });
  });

  it("drops the plan back to free once the last grant has ended", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      await runInMutation(ctx, projectUserPlan(userId, START + 1));
      const afterEnd = await runInMutation(
        ctx,
        projectUserPlan(userId, PERIOD_END + 1)
      );
      const user = await ctx.db.get(userId);
      return { plan: afterEnd, userPlan: user?.plan };
    });
    expect(result).toEqual({ plan: "free", userPlan: "free" });
  });

  it("keeps Pro until the last of two overlapping grants has ended", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const first = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId, PERIOD_END))
      );
      await runInMutation(ctx, syncSubscriptionGrant(first.subscriptionId));
      const second = await runInMutation(
        ctx,
        applySubscriptionState({
          ...proState(accountId, Date.UTC(2026, 11, 1)),
          provider: {
            kind: "polar",
            subscriptionId: "sub_grant_2",
            productId: "prod_grant_1",
            priceId: null,
          },
        })
      );
      await runInMutation(ctx, syncSubscriptionGrant(second.subscriptionId));
      const midway = await runInMutation(
        ctx,
        projectUserPlan(userId, PERIOD_END + 1)
      );
      const afterBoth = await runInMutation(
        ctx,
        projectUserPlan(userId, Date.UTC(2026, 11, 1) + 1)
      );
      return { midway, afterBoth };
    });
    expect(result).toEqual({ midway: "pro", afterBoth: "free" });
  });

  it("keeps Pro on a second projection while the grant still runs", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const first = await runInMutation(
        ctx,
        projectUserPlan(userId, START + 1)
      );
      const again = await runInMutation(
        ctx,
        projectUserPlan(userId, START + 2)
      );
      const credits = (await ctx.db.query("creditTransactions").collect())
        .length;
      return { again, credits, first };
    });
    expect(result).toEqual({ again: "pro", credits: 1, first: "pro" });
  });

  it("writes no grant for a subscription with no period end, so its plan stays free", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState({
          ...proState(accountId),
          currentPeriodEnd: null,
          status: "canceled",
        })
      );
      const grantId = await runInMutation(
        ctx,
        syncSubscriptionGrant(applied.subscriptionId)
      );
      const grants = await ctx.db.query("billingGrants").collect();
      const plan = await runInMutation(
        ctx,
        projectUserPlan(userId, START + 50)
      );
      return { grantId, grants: grants.length, plan };
    });
    expect(result).toEqual({ grantId: null, grants: 0, plan: "free" });
  });

  it("writes a school grant of seats for a school subscription and leaves the person's plan alone", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Kursi",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-kursi",
        status: "active",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "polar",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const applied = await runInMutation(
        ctx,
        applySubscriptionState({
          ...proState(accountId),
          offer: "school.seat.month",
          quantity: 3,
          provider: {
            kind: "polar",
            subscriptionId: "sub_school_1",
            productId: "prod_school_1",
            priceId: null,
          },
        })
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const grants = await ctx.db.query("billingGrants").collect();
      return Arr.map(grants, (grant) => ({
        product: grant.product,
        seats: grant.product === "school" ? grant.seats : null,
      }));
    });
    expect(result).toEqual([{ product: "school", seats: 3 }]);
  });

  it("refuses a school offer on a person's account", async () => {
    const t = createBillingTestConvex();
    const error = await t.run(async (ctx) => {
      const { accountId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState({
          ...proState(accountId),
          offer: "school.seat.year",
        })
      );
      const error = await runInMutation(
        ctx,
        syncSubscriptionGrant(applied.subscriptionId).pipe(Effect.flip)
      );
      return error._tag;
    });
    expect(error).toBe("GrantOwnerMismatch");
  });

  it("keeps the plan of a user whose account is being deleted", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      await ctx.db.patch(userId, { deletionPreparedAt: START });
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      return runInMutation(ctx, projectUserPlan(userId, START + 1));
    });
    expect(result).toBeNull();
  });

  it("refuses a sync for a subscription or an account that is gone, and returns nothing for a user that is gone", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await ctx.db.delete(applied.subscriptionId);
      const missingSubscription = await exitInMutation(
        ctx,
        syncSubscriptionGrant(applied.subscriptionId)
      );
      await ctx.db.delete(userId);
      const missingUser = await runInMutation(
        ctx,
        projectUserPlan(userId, START)
      );
      const accountOnly = await insertPerson(ctx);
      const orphaned = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountOnly.accountId))
      );
      await ctx.db.delete(accountOnly.accountId);
      const missingAccount = await exitInMutation(
        ctx,
        syncSubscriptionGrant(orphaned.subscriptionId)
      );
      return {
        missingAccount: Exit.isFailure(missingAccount),
        missingSubscription: Exit.isFailure(missingSubscription),
        missingUser,
      };
    });
    expect(result).toEqual({
      missingAccount: true,
      missingSubscription: true,
      missingUser: null,
    });
  });

  it("schedules the owner's plan to be recomputed when a grant is written", async () => {
    const t = createBillingTestConvex();
    const jobs = await t.run(async (ctx) => {
      const { accountId } = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      return ctx.db.system.query("_scheduled_functions").collect();
    });
    expect(jobs).toHaveLength(1);
  });

  it("projects a school's grant onto its claimed active members and ends it at its validTo", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const student = await insertPerson(ctx);
      await insertMember(ctx, tenantId, student.userId);
      await insertMember(ctx, tenantId, null);
      await insertMember(ctx, tenantId, null, "operator");
      await insertSchoolGrant(ctx, tenantId, START, PERIOD_END);
      await runInMutation(ctx, projectSchoolPage(tenantId, null, START + 1));
      const during = (await ctx.db.get(student.userId))?.plan;
      const after = await runInMutation(
        ctx,
        projectUserPlan(student.userId, PERIOD_END + 1)
      );
      return { after, during };
    });
    expect(result).toEqual({ after: "free", during: "pro" });
  });

  it("keeps a student's Pro after their own grant ends, while the school grant runs longer", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const student = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(student.accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const tenantId = await insertSchool(ctx);
      await insertMember(ctx, tenantId, student.userId);
      await insertSchoolGrant(ctx, tenantId, START, DECEMBER_END);
      return runInMutation(
        ctx,
        projectUserPlan(student.userId, PERIOD_END + 1)
      );
    });
    expect(result).toBe("pro");
  });

  it("keeps a student's Pro through their own grant when the school grant runs longer", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const student = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(student.accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const tenantId = await insertSchool(ctx);
      await insertMember(ctx, tenantId, student.userId);
      await insertSchoolGrant(ctx, tenantId, START, DECEMBER_END);
      return runInMutation(ctx, projectUserPlan(student.userId, START + 2000));
    });
    expect(result).toBe("pro");
  });

  it("keeps a student's Pro through their own grant while the school grant ends sooner, and drops it once both have ended", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const student = await insertPerson(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(proState(student.accountId))
      );
      await runInMutation(ctx, syncSubscriptionGrant(applied.subscriptionId));
      const tenantId = await insertSchool(ctx);
      await insertMember(ctx, tenantId, student.userId);
      await insertSchoolGrant(ctx, tenantId, START, PERIOD_END - 1000);
      const during = await runInMutation(
        ctx,
        projectUserPlan(student.userId, START + 2000)
      );
      const after = await runInMutation(
        ctx,
        projectUserPlan(student.userId, PERIOD_END + 1)
      );
      return { after, during };
    });
    expect(result).toEqual({ after: "free", during: "pro" });
  });

  it("pages through a school's members, scheduling the next page while members remain", async () => {
    const t = createBillingTestConvex();
    const jobs = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await insertSchoolGrant(ctx, tenantId, START, PERIOD_END);
      const userIds = await Promise.all(
        Arr.makeBy(51, (index) =>
          ctx.db.insert("users", {
            authId: `auth-school-member-${index}`,
            credits: 0,
            creditsResetAt: START,
            email: `school-member-${index}@example.com`,
            mascot: MASCOT_CODE,
            name: `School Member ${index}`,
            plan: "free",
          })
        )
      );
      await Promise.all(
        Arr.map(userIds, (userId) => insertMember(ctx, tenantId, userId))
      );
      await runInMutation(ctx, projectSchoolPage(tenantId, null, START + 1));
      return ctx.db.system.query("_scheduled_functions").collect();
    });
    // One plan recomputation per member of the page, and one job for the next page.
    expect(jobs).toHaveLength(51);
  });
});
