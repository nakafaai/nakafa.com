import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolPeriod } from "@repo/backend/confect/billing/quote";
import { schoolTiers } from "@repo/backend/confect/billing/tiers";
import {
  scheduledJobs,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, DateTime, Duration, Effect } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const { invoice, overview, pay } = refs.public.billing.school;

// Fake timers hold every scheduled job, so the Xendit session a payment asks for is only listed.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("billing/school", () => {
  it.effect(
    "shows the Admin a school on its trial: its accounts against the trial's, its Drive and its last day, and refuses a teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const read = yield* fixture.as("admin").query(overview, { slug: nf });
        expect(read).toMatchObject({
          accounts: { limit: schoolTiers.free.accounts },
          currency: "IDR",
          driveBytes: schoolTiers.free.storageMegabytes * 1_000_000,
          invoices: [],
          plan: { kind: "trial" },
          rail: "xendit",
        });
        expect(read.accounts.used).toBeGreaterThan(0);
        const refused = yield* fixture
          .as("teacher")
          .query(overview, { slug: nf })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("AccessDenied");
      })
  );

  it.effect(
    "bills a school outside Indonesia in its own currency, payable by transfer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("otherOwner");
        const issued = yield* owner.mutation(pay, {
          order: { kind: "plan", accounts: 0, months: 1, plan: "pro" },
          slug: other,
        });
        const read = yield* owner.query(overview, { slug: other });
        expect(read).toMatchObject({
          currency: "EUR",
          invoices: [
            {
              accounts: 100,
              currency: "EUR",
              number: issued.number,
              paymentLink: null,
              total: 10_900,
            },
          ],
          rail: "polar",
        });
      })
  );

  it.effect(
    "issues one open invoice at a time, payable by transfer while Indonesia stays on Polar, shows the plan once it is paid, and lists the renewal first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const issued = yield* owner.mutation(pay, {
          order: { kind: "plan", accounts: 20, months: 3, plan: "pro" },
          slug: nf,
        });
        const again = yield* owner.mutation(pay, {
          order: { kind: "plan", accounts: 0, months: 12, plan: "max" },
          slug: nf,
        });
        expect(again.number).toBe(issued.number);
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.some(jobs, (job) => job.name.includes("billing/xendit/invoice"))
        ).toBe(false);
        const open = yield* owner.query(overview, { slug: nf });
        expect(open.invoices).toMatchObject([
          {
            accounts: 120,
            number: issued.number,
            paymentLink: null,
            status: "open",
            total: 5_370_000 + 20 * 47_700,
          },
        ]);
        yield* fixture.internal.mutation(
          refs.internal.billing.contracts.recordInvoiceTransfer,
          { number: issued.number, paidAt: 0, reference: "BCA-school-test" }
        );
        const paid = yield* owner.query(overview, { slug: nf });
        expect(paid).toMatchObject({
          accounts: { limit: 120 },
          driveBytes: (schoolTiers.pro.storageMegabytes + 20 * 200) * 1_000_000,
          invoices: [{ number: issued.number, status: "paid" }],
          plan: {
            added: 20,
            credits: { capacity: 720, used: 0 },
            kind: "pro",
            period: schoolPeriod(TENANCY_NOW, 3),
          },
        });
        const renewal = yield* owner.mutation(pay, {
          order: { kind: "plan", accounts: 20, months: 3, plan: "pro" },
          slug: nf,
        });
        const listed = yield* owner.query(overview, { slug: nf });
        expect(Arr.map(listed.invoices, (invoice) => invoice.number)).toEqual([
          renewal.number,
          issued.number,
        ]);
      })
  );

  it.effect(
    "opens the hosted payment of a new invoice while Xendit takes Indonesia",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("BILLING_INDONESIA_RAIL", "xendit");
        vi.stubEnv("XENDIT_API_KEY", "test-secret");
        const fixture = yield* tenancyFixture;
        yield* fixture.as("owner").mutation(pay, {
          order: { kind: "plan", accounts: 0, months: 1, plan: "max" },
          slug: nf,
        });
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.some(jobs, (job) => job.name.includes("billing/xendit/invoice"))
        ).toBe(true);
      })
  );

  it.effect(
    "refuses more accounts while no plan runs, before any invoice is issued",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const refused = yield* owner
          .mutation(pay, { order: { kind: "accounts", accounts: 5 }, slug: nf })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("SchoolPlanMissing");
        const read = yield* owner.query(overview, { slug: nf });
        expect(read.invoices).toEqual([]);
      })
  );

  it.effect(
    "shows a contract school's shared AI credits: what its grants hold this month and what its members drew",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const validTo = TENANCY_NOW + Duration.toMillis(Duration.days(90));
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer.table("billingGrants").insert({
              product: "school",
              tenantId: fixture.tenants.nf,
              scope: { kind: "tenant" },
              seats: 300,
              ninaSeats: 300,
              source: { kind: "contract", contractId: "contract-pool" },
              validFrom: 0,
              validTo,
            });
            yield* writer.table("creditPools").insert({
              tenantId: fixture.tenants.nf,
              month: DateTime.formatIsoDateUtc(
                DateTime.makeUnsafe(TENANCY_NOW)
              ).slice(0, 7),
              used: 120,
            });
          })
        );
        const read = yield* fixture.as("owner").query(overview, { slug: nf });
        expect(read).toMatchObject({
          accounts: { limit: 300 },
          driveBytes: 300 * 200_000_000,
          plan: {
            credits: { capacity: 1800, used: 120 },
            kind: "contract",
            validTo,
          },
        });
      })
  );

  it.effect(
    "hands a school the PDF copy of its own invoice, and nothing for an unknown number or another school's",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const otherOwner = fixture.as("otherOwner");
        const issued = yield* owner.mutation(pay, {
          order: { kind: "plan", accounts: 0, months: 1, plan: "pro" },
          slug: nf,
        });
        const read = (viewer: typeof owner, slug: typeof nf, number: string) =>
          viewer.query(invoice, { locale: "en", number, slug });
        const noAccount = yield* read(otherOwner, other, issued.number);
        yield* otherOwner.mutation(pay, {
          order: { kind: "plan", accounts: 0, months: 1, plan: "max" },
          slug: other,
        });
        const notTheirs = yield* read(otherOwner, other, issued.number);
        const unknown = yield* read(owner, nf, "NKF-2099-000001");
        const own = yield* read(owner, nf, issued.number);
        expect([noAccount, notTheirs, unknown]).toEqual([null, null, null]);
        expect(own).toMatchObject({
          lines: [{ description: "Nakafa School Pro" }],
          number: issued.number,
          status: "open",
        });
      })
  );
});
