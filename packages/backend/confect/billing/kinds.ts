import { Kind } from "@repo/backend/confect/access/kind";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { tenant } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/** An invoice number, as `NKF-YYYY-NNNNNN`. */
const InvoiceNumber = Schema.String.check(
  Schema.isPattern(/^NKF-\d{4}-\d{6}$/u)
);

/**
 * The billing of a school (K31): its Owner and Admin read the plan and the
 * invoices and pay them, and the journal keeps every invoice the school was issued
 * and how each one was paid.
 */
const tenantBilling = Kind.extend(tenant, {
  actions: {
    "billing.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "billing.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      currency: BillingCurrency,
      number: InvoiceNumber,
      total: Schema.Int,
      type: Schema.Literal("billing.invoice.issued"),
    }),
    Schema.Struct({
      method: Schema.Literals(["session", "transfer"]),
      number: InvoiceNumber,
      type: Schema.Literal("billing.invoice.paid"),
    }),
  ],
  published: [],
});

/** The billing lane's extension of the tenant kind, for the catalog. */
export const billing = {
  extensions: [tenantBilling],
  kinds: [],
} as const;
