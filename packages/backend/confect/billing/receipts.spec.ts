import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { InvoiceInput } from "@repo/pdf/invoice/contract";
import { Schema } from "effect";

/** The buyer asked for an invoice Nakafa cannot give: another's, unpaid, or sold by another merchant. */
export class ReceiptUnavailable extends Schema.TaggedError<ReceiptUnavailable>()(
  "ReceiptUnavailable",
  {
    code: Schema.Literal("BILLING_RECEIPT_UNAVAILABLE"),
    message: Schema.String,
  }
) {}

/** One invoice file, its bytes in Base64 and the name it saves under. */
const ReceiptFile = Schema.Struct({
  base64: Schema.String,
  name: Schema.String,
});

/**
 * A learner's invoice of a payment Nakafa sold through Xendit. Polar is the merchant
 * of its own sales, so its invoices stay in Polar's portal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "download",
      args: () => ({
        locale: ActiveAppLocaleCodeSchema,
        paymentId: Id("billingPayments"),
      }),
      returns: () => ReceiptFile,
      error: () => Schema.Union([AuthFailure, ReceiptUnavailable]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({
        locale: ActiveAppLocaleCodeSchema,
        paymentId: Id("billingPayments"),
        userId: Id("users"),
      }),
      returns: () => Schema.NullOr(InvoiceInput),
    })
  );
