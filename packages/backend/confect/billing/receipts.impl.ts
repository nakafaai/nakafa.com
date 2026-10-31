import { FunctionImpl, GroupImpl } from "@confect/server";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionRunner,
  DatabaseReader,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { paymentInvoice } from "@repo/backend/confect/billing/receipts";
import spec, {
  ReceiptUnavailable,
} from "@repo/backend/confect/billing/receipts.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Option } from "effect";

/** The invoice of one succeeded Xendit payment of the learner, and nothing for any other payment. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("billing.receipts.read")(function* ({ locale, paymentId, userId }) {
    const reader = yield* DatabaseReader;
    const payment = yield* reader
      .table("billingPayments")
      .get(paymentId)
      .pipe(Effect.option);
    if (
      Option.isNone(payment) ||
      payment.value.rail !== "xendit" ||
      payment.value.status !== "succeeded"
    ) {
      return null;
    }
    const account = yield* reader
      .table("billingAccounts")
      .get(payment.value.accountId)
      .pipe(Effect.orDie);
    if (account.owner.kind !== "personal" || account.owner.userId !== userId) {
      return null;
    }
    const buyer = yield* reader.table("users").get(userId).pipe(Effect.orDie);
    return paymentInvoice(payment.value, buyer, locale);
  })
);

/** Draws the invoice of one of the viewer's payments. */
const download = FunctionImpl.make(
  databaseSchema,
  spec,
  "download",
  Effect.fn("billing.receipts.download")(function* ({ locale, paymentId }) {
    const { appUser } = yield* requireAuth();
    const invoice = yield* (yield* QueryRunner)
      .runQuery(billingInternal.receipts.read, {
        locale,
        paymentId,
        userId: appUser._id,
      })
      .pipe(Effect.orDie);
    if (invoice === null) {
      return yield* new ReceiptUnavailable({
        code: "BILLING_RECEIPT_UNAVAILABLE",
        message: "This payment has no invoice for the viewer.",
      });
    }
    const base64 = yield* (yield* ActionRunner)
      .runAction(billingInternal.draw.invoice, invoice)
      .pipe(Effect.orDie);
    return { base64, name: `nakafa-invoice-${invoice.number}.pdf` };
  })
);

/** A learner's invoices. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(download),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
