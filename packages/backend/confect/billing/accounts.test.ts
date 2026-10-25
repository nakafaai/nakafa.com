import { describe, expect, it } from "@effect/vitest";
import {
  ensureAccount,
  linkPolarCustomer,
  recordProviderCustomer,
} from "@repo/backend/confect/billing/accounts";
import {
  createBillingTestConvex,
  insertPolarAccount,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Option } from "effect";

describe("billing/accounts", () => {
  it("makes one account per owner and rail and reuses it", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-billing-account",
        credits: 0,
        creditsResetAt: 0,
        email: "billing-account@example.com",
        mascot: MASCOT_CODE,
        name: "Billing Account",
        plan: "free",
      });
      const owner = { kind: "personal" as const, userId };
      const first = await runInMutation(
        ctx,
        ensureAccount({ owner, rail: "polar", country: "ID", currency: "IDR" })
      );
      const again = await runInMutation(
        ctx,
        ensureAccount({ owner, rail: "polar", country: "ID", currency: "IDR" })
      );
      const onXendit = await runInMutation(
        ctx,
        ensureAccount({ owner, rail: "xendit", country: "ID", currency: "IDR" })
      );
      await runInMutation(ctx, recordProviderCustomer(first, "cust_polar_1"));
      const accounts = await ctx.db.query("billingAccounts").collect();
      return {
        accounts: accounts.length,
        customer: Option.getOrUndefined(
          Arr.findFirst(accounts, (account) => account._id === first)
        )?.providerCustomerId,
        reused: first === again,
        separate: first !== onXendit,
      };
    });
    expect(result).toEqual({
      accounts: 2,
      customer: "cust_polar_1",
      reused: true,
      separate: true,
    });
  });

  it("keeps a tenant account apart from a person's account", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Billing",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-billing",
        status: "active",
      });
      const userId = await ctx.db.insert("users", {
        authId: "auth-billing-tenant",
        credits: 0,
        creditsResetAt: 0,
        email: "billing-tenant@example.com",
        mascot: MASCOT_CODE,
        name: "Billing Tenant",
        plan: "free",
      });
      const school = await runInMutation(
        ctx,
        ensureAccount({
          owner: { kind: "tenant", tenantId },
          rail: "polar",
          country: "ID",
          currency: "IDR",
        })
      );
      const person = await runInMutation(
        ctx,
        ensureAccount({
          owner: { kind: "personal", userId },
          rail: "polar",
          country: "ID",
          currency: "IDR",
        })
      );
      return { distinct: school !== person };
    });
    expect(result).toEqual({ distinct: true });
  });

  it("links a Polar customer to the account of the user whose auth ID it names, opening the account in the country Polar holds", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await seedUser(ctx, "auth-link-open");
      const outcome = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-link-open",
          country: "ID",
          providerCustomerId: "cust_link_open",
        })
      );
      const accounts = await ctx.db.query("billingAccounts").collect();
      return { outcome, accounts, userId };
    });
    expect(result.outcome).toBe("linked");
    expect(result.accounts).toMatchObject([
      {
        owner: { kind: "personal", userId: result.userId },
        rail: "polar",
        country: "ID",
        currency: "IDR",
        providerCustomerId: "cust_link_open",
      },
    ]);
  });

  it("reports a customer whose auth ID names no user, and opens no account", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const outcome = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-nobody",
          country: "ZZ",
          providerCustomerId: "cust_nobody",
        })
      );
      return {
        outcome,
        accounts: await ctx.db.query("billingAccounts").collect(),
      };
    });
    expect(result).toEqual({ accounts: [], outcome: "noUser" });
  });

  it("links nothing for a user whose account is being deleted", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedUser(ctx, "auth-link-deleting", 1);
      const outcome = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-link-deleting",
          country: "ZZ",
          providerCustomerId: "cust_deleting",
        })
      );
      return {
        outcome,
        accounts: await ctx.db.query("billingAccounts").collect(),
      };
    });
    expect(result).toEqual({ accounts: [], outcome: "unavailable" });
  });

  it("records the customer on an account that holds none, and reports the same customer as linked again", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await seedUser(ctx, "auth-link-existing");
      await insertPolarAccount(ctx, userId, null);
      const first = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-link-existing",
          country: "ZZ",
          providerCustomerId: "cust_existing",
        })
      );
      const again = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-link-existing",
          country: "ZZ",
          providerCustomerId: "cust_existing",
        })
      );
      return {
        again,
        first,
        accounts: await ctx.db.query("billingAccounts").collect(),
      };
    });
    expect(result.first).toBe("linked");
    expect(result.again).toBe("linked");
    expect(result.accounts).toMatchObject([
      { providerCustomerId: "cust_existing" },
    ]);
  });

  it("reports a conflict when the account holds another customer, and changes nothing", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await seedUser(ctx, "auth-link-conflict");
      await insertPolarAccount(ctx, userId, "cust_held");
      const outcome = await runInMutation(
        ctx,
        linkPolarCustomer({
          authId: "auth-link-conflict",
          country: "ZZ",
          providerCustomerId: "cust_other",
        })
      );
      return {
        outcome,
        accounts: await ctx.db.query("billingAccounts").collect(),
      };
    });
    expect(result.outcome).toBe("conflict");
    expect(result.accounts).toMatchObject([
      { providerCustomerId: "cust_held" },
    ]);
  });
});

/** Inserts one user with the given auth ID, optionally marked as being deleted. */
function seedUser(
  ctx: Parameters<typeof insertPolarAccount>[0],
  authId: string,
  deletedAt?: number
) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    email: `${authId}@example.com`,
    mascot: MASCOT_CODE,
    name: "Link Account",
    plan: "free",
    ...(deletedAt === undefined ? {} : { deletedAt }),
  });
}
