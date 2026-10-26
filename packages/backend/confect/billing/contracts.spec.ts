import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  BillingRowMissing,
  ContractWindowInvalid,
  InvoiceNotFound,
  TenantNotFound,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** What recording a contract or a pilot wrote: the school's account and the grant. */
const recordedGrant = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  grantId: IdSchema("billingGrants"),
});

/**
 * The operator commands of school billing: record one signed contract, record a
 * school's free pilot exam (K47), issue the invoice of an Enterprise contract
 * (K9), and record a bank transfer received for an invoice. They are internal: no
 * client calls them, and an operator runs them from the Convex dashboard or CLI.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordSchoolContract",
      args: () => ({
        tenantSlug: Schema.String,
        contractId: Schema.String,
        seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
        validFrom: Schema.Finite,
        validTo: Schema.Finite,
      }),
      returns: () => recordedGrant,
      error: () => Schema.Union([TenantNotFound, ContractWindowInvalid]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordSchoolPilot",
      args: () => ({
        tenantSlug: Schema.String,
        seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
        validFrom: Schema.Finite,
        validTo: Schema.Finite,
      }),
      returns: () => recordedGrant,
      error: () => Schema.Union([TenantNotFound, ContractWindowInvalid]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "issueContractInvoice",
      args: () => ({
        tenantSlug: Schema.String,
        description: Schema.String.check(Schema.isMinLength(1)),
        seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
        unitAmount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        periodStart: Schema.Finite,
        periodEnd: Schema.Finite,
        buyerTaxId: Schema.NullOr(Schema.String),
      }),
      returns: () =>
        Schema.Struct({
          invoiceId: IdSchema("billingInvoices"),
          number: Schema.String,
          total: Schema.Int,
        }),
      error: () => Schema.Union([TenantNotFound, ContractWindowInvalid]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordInvoiceTransfer",
      args: () => ({
        number: Schema.String,
        paidAt: Schema.Finite,
        reference: Schema.String,
      }),
      returns: () => Schema.Literals(["applied", "duplicate"]),
      error: () => Schema.Union([InvoiceNotFound, BillingRowMissing]),
    }).middleware(Atomic)
  );
