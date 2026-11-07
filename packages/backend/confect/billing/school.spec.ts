import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { SchoolOrder, SchoolPeriod } from "@repo/backend/confect/billing/quote";
import {
  BillingRail,
  billingInvoiceValidator,
} from "@repo/backend/confect/billing/schema";
import { SchoolPlanMissingWire } from "@repo/backend/confect/billing/spec";
import { PaidSchoolPlan } from "@repo/backend/confect/billing/tier";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema, Struct } from "effect";

/**
 * One invoice as the billing page lists it, with the accounts it pays for. The
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
  accounts: Schema.Int,
});

/** What a school's members drew from its shared AI credits this month, and what its grants hold. */
const SchoolCredits = Schema.Struct({
  capacity: Schema.Int,
  used: Schema.Int,
});

/**
 * The plan a school is on: the trial until the day it ends; Pro or Max over its
 * period, with the accounts it added and its shared AI credits; or an Enterprise
 * contract until the day it ends.
 */
const SchoolPlanState = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("trial"),
    endsAt: Schema.Finite,
  }),
  Schema.Struct({
    kind: PaidSchoolPlan,
    period: SchoolPeriod,
    added: Schema.Int,
    credits: SchoolCredits,
  }),
  Schema.Struct({
    kind: Schema.Literal("contract"),
    validTo: Schema.Finite,
    credits: SchoolCredits,
  }),
]);

/**
 * The school's billing as its Owner and Admin see it: its plan, the accounts it
 * holds against the accounts it may hold, its Drive, its rail and currency, and
 * its invoices.
 */
const SchoolBilling = Schema.Struct({
  tenantId: IdSchema("tenants"),
  plan: SchoolPlanState,
  accounts: Schema.Struct({ limit: Schema.Int, used: Schema.Int }),
  driveBytes: Schema.Int,
  rail: BillingRail,
  currency: BillingCurrency,
  invoices: Schema.Array(InvoiceRow),
});

/**
 * The billing of a school (K31, K47), which only its Owner and Admin see. `pay`
 * issues the invoice of one order, a plan or more accounts, and opens its hosted
 * payment when the Indonesia rail is Xendit.
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
    FunctionSpec.publicQuery({
      name: "invoice",
      args: () => ({
        locale: ActiveAppLocaleCodeSchema,
        number: Schema.String,
        slug: TenantSlug,
      }),
      returns: () => Schema.NullOr(InvoiceInput),
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "billing.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "pay",
      args: () => ({ slug: TenantSlug, order: SchoolOrder }),
      returns: () => Schema.Struct({ number: Schema.String }),
      error: () => Schema.Union([AccessDenied, SchoolPlanMissingWire]),
    }).middleware(TenantAccess, { action: "billing.manage" })
  );
