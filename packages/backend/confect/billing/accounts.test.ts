import { describe, expect, it } from "@effect/vitest";
import {
  ensureAccount,
  recordProviderCustomer,
} from "@repo/backend/confect/billing/accounts";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

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
        customer: accounts.find((account) => account._id === first)
          ?.providerCustomerId,
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
});
