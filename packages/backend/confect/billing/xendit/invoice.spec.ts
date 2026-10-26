import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { TermOffer } from "@repo/backend/confect/billing/term";
import { Schema } from "effect";

/** An open invoice that holds no payment link yet: what its hosted payment needs. */
const PayableInvoice = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  dueAt: Schema.Finite,
  number: Schema.String,
  total: Schema.Int,
});

/**
 * The hosted payment of a school invoice: `open` asks Xendit for the session,
 * `payable` reads the invoice it pays, and `record` stores the session as the
 * invoice's checkout and payment link.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalAction({
      name: "open",
      args: () => ({
        invoiceId: IdSchema("billingInvoices"),
        offer: TermOffer,
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "payable",
      args: () => ({ invoiceId: IdSchema("billingInvoices") }),
      returns: () => Schema.NullOr(PayableInvoice),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "record",
      args: () => ({
        accountId: IdSchema("billingAccounts"),
        expiresAt: Schema.Finite,
        invoiceId: IdSchema("billingInvoices"),
        offer: TermOffer,
        sessionId: Schema.String,
        url: Schema.String,
      }),
      returns: () => Schema.Null,
    })
  );
