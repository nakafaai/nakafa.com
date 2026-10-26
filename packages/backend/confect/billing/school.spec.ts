import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  BillingRail,
  billingInvoiceValidator,
} from "@repo/backend/confect/billing/schema";
import {
  CheckoutOfferUnavailableWire,
  SchoolSeatsPaidWire,
} from "@repo/backend/confect/billing/spec";
import { SchoolOffer, TermOffer } from "@repo/backend/confect/billing/term";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema, Struct } from "effect";

/**
 * What one School offer would cost if the school paid for it now: the students it
 * bills, each one's price, and the period it covers. An invoice term is priced for
 * its days left; a Polar subscription starts now at the catalog price.
 */
const SchoolQuote = Schema.Struct({
  offer: SchoolOffer,
  seats: Schema.Int,
  unitAmount: Schema.Int,
  total: Schema.Int,
  periodStart: Schema.Finite,
  periodEnd: Schema.Finite,
});

/**
 * One invoice as the billing page lists it, with the students it pays for. The
 * number is plain text on the wire, so the page can list an invoice it has asked
 * for before the server numbers it.
 */
const InvoiceRow = Schema.Struct({
  ...Struct.pick(billingInvoiceValidator.fields, [
    "status",
    "currency",
    "total",
    "periodStart",
    "periodEnd",
    "dueAt",
    "paymentLink",
  ]),
  number: Schema.String,
  seats: Schema.Int,
});

/** The plan a school is on: free up to its limit of students (K41), or School, which pays for its seats until a date. */
const SchoolPlan = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("free"),
    limit: Schema.Int,
  }),
  Schema.Struct({
    kind: Schema.Literal("school"),
    seats: Schema.Int,
    validTo: Schema.Finite,
    /** The school's Nina pool this month (K46): what its grants hold for the students they cover, and what its members drew. */
    nina: Schema.Struct({ capacity: Schema.Int, used: Schema.Int }),
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/** The school's billing as its Owner and Admin see it: the school, its plan and students, its rail and currency, the offers it can pay, and its invoices. */
const SchoolBilling = Schema.Struct({
  tenantId: IdSchema("tenants"),
  plan: SchoolPlan,
  students: Schema.Int,
  rail: BillingRail,
  currency: BillingCurrency,
  quotes: Schema.Array(SchoolQuote),
  invoices: Schema.Array(InvoiceRow),
});

/**
 * The billing of a school (K31, K41, K45, K47), which only its Owner and Admin
 * see. `pay` issues the invoice of one term for the students not yet paid for,
 * and opens its hosted payment when the Indonesia rail is Xendit.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "overview",
      args: () => ({ slug: TenantSlug }),
      returns: () => SchoolBilling,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "billing.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "pay",
      args: () => ({ slug: TenantSlug, offer: TermOffer }),
      returns: () => Schema.Struct({ number: Schema.String }),
      error: () =>
        Schema.Union([
          AccessDenied,
          CheckoutOfferUnavailableWire,
          SchoolSeatsPaidWire,
        ]),
    }).middleware(TenantAccess, { action: "billing.manage" })
  );
