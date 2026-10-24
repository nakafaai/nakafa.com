import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { recordSchoolContract } from "@repo/backend/confect/billing/contracts";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { Array as Arr, Effect, Schema } from "effect";

const TERM_START = Date.UTC(2026, 6, 1);
const TERM_END = Date.UTC(2027, 5, 30);
const CONTRACT = {
  contractId: "contract-quran-as-salaam-2026",
  seats: 300,
  tenantSlug: "quran-as-salaam",
  validFrom: TERM_START,
  validTo: TERM_END,
};

/** Inserts the school the operator names, as the onboarding made it. */
function insertSchool(
  ctx: Parameters<
    Parameters<ReturnType<typeof createBillingTestConvex>["run"]>[0]
  >[0]
) {
  return ctx.db.insert("tenants", {
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: "SMP Quran As-Salaam",
    policies: { emailDomains: [], nina: false, studentThreads: false },
    slug: "quran-as-salaam",
    status: "active",
  });
}

describe("billing/contracts", () => {
  it("records a contract as a school grant of seats with no Nina pool", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await insertSchool(ctx);
      const recorded = await runInMutation(ctx, recordSchoolContract(CONTRACT));
      const grants = await ctx.db.query("billingGrants").collect();
      const accounts = await ctx.db.query("billingAccounts").collect();
      return {
        accounts: Arr.map(accounts, (account) => ({
          currency: account.currency,
          owner: account.owner.kind,
          rail: account.rail,
        })),
        grantId: recorded.grantId,
        grants: Arr.map(grants, (grant) => ({
          contractId:
            grant.source.kind === "contract" ? grant.source.contractId : null,
          ninaSeats: grant.product === "school" ? grant.ninaSeats : null,
          product: grant.product,
          seats: grant.product === "school" ? grant.seats : null,
          validTo: grant.validTo,
        })),
      };
    });
    expect(result.grants).toEqual([
      {
        contractId: "contract-quran-as-salaam-2026",
        ninaSeats: 0,
        product: "school",
        seats: 300,
        validTo: TERM_END,
      },
    ]);
    expect(result.accounts).toEqual([
      { currency: "IDR", owner: "tenant", rail: "polar" },
    ]);
  });

  it("refuses a slug that no school carries", async () => {
    const t = createBillingTestConvex();
    const tag = await t.run(async (ctx) => {
      const error = await runInMutation(
        ctx,
        recordSchoolContract({ ...CONTRACT, tenantSlug: "missing" }).pipe(
          Effect.flip
        )
      );
      return error._tag;
    });
    expect(tag).toBe("TenantNotFound");
  });

  it.effect("runs the operator command through its registered function", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* t.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          yield* writer.table("tenants").insert({
            country: "ID",
            currency: "IDR",
            kind: "school",
            name: "SMP Quran As-Salaam",
            policies: { emailDomains: [], nina: false, studentThreads: false },
            slug: yield* Schema.decodeEffect(TenantSlug)("quran-as-salaam"),
            status: "active",
          });
        })
      );
      const recorded = yield* t.mutation(
        refs.internal.billing.contracts.recordSchoolContract,
        CONTRACT
      );
      expect(recorded.grantId).toBeDefined();
      const error = yield* t
        .mutation(refs.internal.billing.contracts.recordSchoolContract, {
          ...CONTRACT,
          tenantSlug: "missing",
        })
        .pipe(Effect.flip);
      expect(error._tag).toBe("TenantNotFound");
    }).pipe(Effect.provide(confectLayer))
  );

  it("refuses a contract that ends no later than it starts", async () => {
    const t = createBillingTestConvex();
    const tag = await t.run(async (ctx) => {
      await insertSchool(ctx);
      const error = await runInMutation(
        ctx,
        recordSchoolContract({ ...CONTRACT, validTo: TERM_START }).pipe(
          Effect.flip
        )
      );
      return error._tag;
    });
    expect(tag).toBe("ContractWindowInvalid");
  });

  it("returns the grant the first call wrote when the same contract is recorded again", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await insertSchool(ctx);
      const first = await runInMutation(ctx, recordSchoolContract(CONTRACT));
      const again = await runInMutation(ctx, recordSchoolContract(CONTRACT));
      const grants = await ctx.db.query("billingGrants").collect();
      return { grants: grants.length, same: first.grantId === again.grantId };
    });
    expect(result).toEqual({ grants: 1, same: true });
  });
});
