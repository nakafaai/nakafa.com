import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  issueContractInvoice,
  recordInvoiceTransfer,
  recordSchoolContract,
} from "@repo/backend/confect/billing/contracts";
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
      { currency: "IDR", owner: "tenant", rail: "xendit" },
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

  it.effect(
    "records a school's one free pilot exam, and a bank transfer for an invoice, through their registered functions",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const tenantId = yield* writer.table("tenants").insert({
              country: "ID",
              currency: "IDR",
              kind: "school",
              name: "SMP Quran As-Salaam",
              policies: {
                emailDomains: [],
                nina: false,
                studentThreads: false,
              },
              slug: yield* Schema.decodeEffect(TenantSlug)("quran-as-salaam"),
              status: "active",
            });
            const accountId = yield* writer.table("billingAccounts").insert({
              owner: { kind: "tenant", tenantId },
              rail: "xendit",
              country: "ID",
              currency: "IDR",
              providerCustomerId: null,
            });
            yield* writer.table("billingInvoices").insert({
              accountId,
              number: "NKF-2026-000042",
              status: "open",
              currency: "IDR",
              lines: [
                {
                  description: "school.seat.year",
                  quantity: 300,
                  unitAmount: 100_000,
                  amount: 30_000_000,
                },
              ],
              total: 30_000_000,
              periodStart: TERM_START,
              periodEnd: TERM_END,
              dueAt: TERM_START,
              paymentLink: null,
              buyerTaxId: null,
            });
          })
        );
        const pilot = {
          seats: 300,
          tenantSlug: "quran-as-salaam",
          validFrom: TERM_START,
          validTo: TERM_START + 7 * 24 * 60 * 60 * 1000,
        };
        const first = yield* t.mutation(
          refs.internal.billing.contracts.recordSchoolPilot,
          pilot
        );
        const again = yield* t.mutation(
          refs.internal.billing.contracts.recordSchoolPilot,
          { ...pilot, validTo: TERM_END }
        );
        expect(again.grantId).toBe(first.grantId);
        const transfer = {
          number: "NKF-2026-000042",
          paidAt: TERM_START,
          reference: "BCA-20260701-0001",
        };
        expect(
          yield* t.mutation(
            refs.internal.billing.contracts.recordInvoiceTransfer,
            transfer
          )
        ).toBe("applied");
        expect(
          yield* t.mutation(
            refs.internal.billing.contracts.recordInvoiceTransfer,
            transfer
          )
        ).toBe("duplicate");
      }).pipe(Effect.provide(confectLayer))
  );

  it("refuses a transfer for an invoice number nobody was issued", async () => {
    const t = createBillingTestConvex();
    const tag = await t.run(async (ctx) => {
      const error = await runInMutation(
        ctx,
        recordInvoiceTransfer({
          number: "NKF-2026-999999",
          paidAt: TERM_START,
          reference: "BCA-missing",
        }).pipe(Effect.flip)
      );
      return error._tag;
    });
    expect(tag).toBe("InvoiceNotFound");
  });

  it("issues an Enterprise contract invoice at the contract's price, whose recorded transfer grants its seats for the period", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TERM_START);
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await insertSchool(ctx);
      const issued = await runInMutation(
        ctx,
        issueContractInvoice({
          buyerTaxId: "01.234.567.8-901.000",
          description: "Enterprise 2026/2027",
          periodEnd: TERM_END,
          periodStart: TERM_START,
          seats: 2400,
          tenantSlug: "quran-as-salaam",
          unitAmount: 80_000,
        })
      );
      const paid = await runInMutation(
        ctx,
        recordInvoiceTransfer({
          number: issued.number,
          paidAt: TERM_START,
          reference: "BCA-enterprise-1",
        })
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        invoice: await ctx.db.get(issued.invoiceId),
        journal: Arr.map(
          await ctx.db.query("journalEntries").collect(),
          (entry) => entry.change.type
        ),
        paid,
      };
    });
    vi.useRealTimers();
    expect(result.paid).toBe("applied");
    expect(result.invoice).toMatchObject({
      buyerTaxId: "01.234.567.8-901.000",
      currency: "IDR",
      dueAt: TERM_START + 30 * 24 * 60 * 60 * 1000,
      lines: [
        {
          amount: 192_000_000,
          description: "Enterprise 2026/2027",
          quantity: 2400,
          unitAmount: 80_000,
        },
      ],
      status: "paid",
      total: 192_000_000,
    });
    expect(result.grants).toMatchObject([
      {
        ninaSeats: 2400,
        seats: 2400,
        source: { kind: "invoice" },
        validFrom: TERM_START,
        validTo: TERM_END,
      },
    ]);
    expect(result.journal).toEqual(
      expect.arrayContaining(["billing.invoice.issued", "billing.invoice.paid"])
    );
  });

  it("refuses a contract invoice whose period ends no later than it starts, or for a slug no school carries", async () => {
    const t = createBillingTestConvex();
    const tags = await t.run(async (ctx) => {
      await insertSchool(ctx);
      const invoice = {
        buyerTaxId: null,
        description: "Enterprise",
        periodEnd: TERM_END,
        periodStart: TERM_START,
        seats: 1,
        tenantSlug: "quran-as-salaam",
        unitAmount: 1,
      };
      const window = await runInMutation(
        ctx,
        issueContractInvoice({ ...invoice, periodEnd: TERM_START }).pipe(
          Effect.flip
        )
      );
      const missing = await runInMutation(
        ctx,
        issueContractInvoice({ ...invoice, tenantSlug: "missing" }).pipe(
          Effect.flip
        )
      );
      return [window._tag, missing._tag];
    });
    expect(tags).toEqual(["ContractWindowInvalid", "TenantNotFound"]);
  });

  it.effect(
    "asks for the hosted payment of a contract invoice through its registered function while Xendit takes Indonesia",
    () =>
      Effect.gen(function* () {
        // Fake timers hold the scheduled Xendit session, so the test only finds it listed.
        vi.useFakeTimers();
        vi.stubEnv("BILLING_INDONESIA_RAIL", "xendit");
        vi.stubEnv("XENDIT_API_KEY", "test-secret");
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer.table("tenants").insert({
              country: "ID",
              currency: "IDR",
              kind: "school",
              name: "SMP Quran As-Salaam",
              policies: {
                emailDomains: [],
                nina: false,
                studentThreads: false,
              },
              slug: yield* Schema.decodeEffect(TenantSlug)("quran-as-salaam"),
              status: "active",
            });
          })
        );
        const issued = yield* t.mutation(
          refs.internal.billing.contracts.issueContractInvoice,
          {
            buyerTaxId: null,
            description: "Enterprise 2026/2027",
            periodEnd: TERM_END,
            periodStart: TERM_START,
            seats: 2,
            tenantSlug: "quran-as-salaam",
            unitAmount: 80_000,
          }
        );
        expect(issued.total).toBe(160_000);
        const opensSession = yield* t.run(
          Effect.flatMap(MutationCtx, (ctx) =>
            Effect.promise(() =>
              ctx.db.system.query("_scheduled_functions").collect()
            )
          ).pipe(
            Effect.map(
              Arr.some((job) => job.name.includes("billing/xendit/invoice"))
            )
          ),
          Schema.Boolean
        );
        expect(opensSession).toBe(true);
      }).pipe(
        Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())),
        Effect.provide(confectLayer)
      )
  );
});
