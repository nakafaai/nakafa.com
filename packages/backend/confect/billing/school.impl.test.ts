import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { SCHOOL_FREE_STUDENTS } from "@repo/backend/confect/billing/catalog";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  grantRole,
  invitePerson,
  scheduledJobs,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, DateTime, Duration, Effect, Schema } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const { overview, pay } = refs.public.billing.school;
const schueler = Schema.decodeSync(Email)("schueler@other.example.test");

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
    "shows the Admin a free school's students and its terms, and refuses a teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const read = yield* fixture.as("admin").query(overview, { slug: nf });
        expect(read).toMatchObject({
          currency: "IDR",
          invoices: [],
          plan: { kind: "free", limit: SCHOOL_FREE_STUDENTS },
          rail: "xendit",
        });
        expect(read.students).toBeGreaterThan(0);
        expect(Arr.map(read.quotes, (quote) => quote.offer)).toEqual([
          "school.seat.semester",
          "school.seat.year",
        ]);
        expect(
          Arr.every(read.quotes, (quote) => quote.seats === read.students)
        ).toBe(true);
        const refused = yield* fixture
          .as("teacher")
          .query(overview, { slug: nf })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("AccessDenied");
      })
  );

  it.effect(
    "quotes no term to a school outside Indonesia, which pays through Polar",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const read = yield* fixture
          .as("otherOwner")
          .query(overview, { slug: other });
        expect(read).toMatchObject({
          currency: "EUR",
          quotes: [],
          rail: "polar",
        });
      })
  );

  it.effect(
    "issues one invoice per term, payable by transfer while Indonesia stays on Polar, and shows School once it is paid",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const issued = yield* owner.mutation(pay, {
          offer: "school.seat.year",
          slug: nf,
        });
        const again = yield* owner.mutation(pay, {
          offer: "school.seat.year",
          slug: nf,
        });
        expect(again.number).toBe(issued.number);
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.some(jobs, (job) => job.name.includes("billing/xendit/invoice"))
        ).toBe(false);
        const open = yield* owner.query(overview, { slug: nf });
        expect(open.invoices).toMatchObject([
          { number: issued.number, paymentLink: null, status: "open" },
        ]);
        yield* fixture.internal.mutation(
          refs.internal.billing.contracts.recordInvoiceTransfer,
          { number: issued.number, paidAt: 0, reference: "BCA-school-test" }
        );
        const paid = yield* owner.query(overview, { slug: nf });
        expect(paid).toMatchObject({
          invoices: [{ number: issued.number, status: "paid" }],
          plan: {
            kind: "school",
            nina: { capacity: open.students * 100, used: 0 },
            seats: open.students,
          },
          quotes: [],
        });
        const nothingLeft = yield* owner
          .mutation(pay, { offer: "school.seat.semester", slug: nf })
          .pipe(Effect.flip);
        expect(nothingLeft._tag).toBe("SchoolSeatsPaid");
      })
  );

  it.effect(
    "opens the hosted payment of a new invoice while Xendit takes Indonesia",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("BILLING_INDONESIA_RAIL", "xendit");
        vi.stubEnv("XENDIT_API_KEY", "test-secret");
        const fixture = yield* tenancyFixture;
        yield* fixture
          .as("owner")
          .mutation(pay, { offer: "school.seat.semester", slug: nf });
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.some(jobs, (job) => job.name.includes("billing/xendit/invoice"))
        ).toBe(true);
      })
  );

  it.effect(
    "refuses a term the school's currency has no price for, before any invoice is issued",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = yield* fixture.run(
          invitePerson(fixture.tenants.other, schueler)
        );
        yield* fixture.run(
          grantRole(fixture.tenants.other, personId, "student", {
            kind: "tenant",
          })
        );
        const refused = yield* fixture
          .as("otherOwner")
          .mutation(pay, { offer: "school.seat.semester", slug: other })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("CheckoutOfferUnavailable");
        const read = yield* fixture
          .as("otherOwner")
          .query(overview, { slug: other });
        expect(read.invoices).toEqual([]);
      })
  );

  it.effect("lists a school's invoices newest first", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const semester = yield* owner.mutation(pay, {
        offer: "school.seat.semester",
        slug: nf,
      });
      const year = yield* owner.mutation(pay, {
        offer: "school.seat.year",
        slug: nf,
      });
      const read = yield* owner.query(overview, { slug: nf });
      expect(Arr.map(read.invoices, (invoice) => invoice.number)).toEqual([
        year.number,
        semester.number,
      ]);
    })
  );

  it.effect(
    "shows a paid school's Nina pool: what its grants hold this month and what its members drew",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer.table("billingGrants").insert({
              product: "school",
              tenantId: fixture.tenants.nf,
              scope: { kind: "tenant" },
              seats: 3,
              ninaSeats: 3,
              source: { kind: "contract", contractId: "contract-pool" },
              validFrom: 0,
              validTo: TENANCY_NOW + Duration.toMillis(Duration.days(90)),
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
        expect(read.plan).toMatchObject({
          kind: "school",
          nina: { capacity: 300, used: 120 },
          seats: 3,
        });
      })
  );
});
